import ExpoModulesCore
import Foundation
import HealthKit

public class PushPullAppleHealthKit: Module {
  private final class ResultsBox {
    var value: [[String: Any]]
    init(_ value: [[String: Any]]) {
      self.value = value
    }
  }

  private let healthStore = HKHealthStore()
  private let heartRateUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
  private let energyUnit = HKUnit.kilocalorie()
  private let isoFormatterWithFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
  private let isoFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter
  }()

  public func definition() -> ModuleDefinition {
    Name("PushPullAppleHealthKit")

    AsyncFunction("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("initHealthKit") { [weak self] (input: [String: Any], promise: Promise) in
      guard let self = self else { return }

      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject(
          "E_HEALTHKIT_UNAVAILABLE",
          "Health data is not available on this device."
        )
        return
      }

      guard let permissions = input["permissions"] as? [String: Any] else {
        promise.reject(
          "E_HEALTHKIT_INVALID_PERMISSIONS",
          "Invalid permissions payload."
        )
        return
      }

      let readAny = permissions["read"]
      let readPermissions: [String]
      if let read = readAny as? [String] {
        readPermissions = read
      } else if let read = readAny as? [Any] {
        readPermissions = read.compactMap { $0 as? String }
      } else {
        readPermissions = []
      }

      if readPermissions.isEmpty {
        promise.reject(
          "E_HEALTHKIT_INVALID_PERMISSIONS",
          "Invalid permissions payload (missing permissions.read)."
        )
        return
      }

      var readTypes = Set<HKObjectType>()
      for permission in readPermissions {
        switch permission {
        case "Workout":
          readTypes.insert(HKObjectType.workoutType())
        case "ActiveEnergyBurned":
          if let t = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            readTypes.insert(t)
          }
        case "HeartRate":
          if let t = HKObjectType.quantityType(forIdentifier: .heartRate) {
            readTypes.insert(t)
          }
        default:
          break
        }
      }

      self.healthStore.requestAuthorization(toShare: nil, read: readTypes) { success, error in
        if let error = error {
          promise.reject("E_HEALTHKIT_AUTH", error.localizedDescription)
          return
        }
        promise.resolve(success)
      }
    }

    AsyncFunction("getWorkouts") { [weak self] (input: [String: Any], promise: Promise) in
      guard let self = self else { return }

      guard HKHealthStore.isHealthDataAvailable() else {
        promise.reject(
          "E_HEALTHKIT_UNAVAILABLE",
          "Health data is not available on this device."
        )
        return
      }

      guard
        let startDateString = input["startDate"] as? String,
        let startDate = self.parseISODate(startDateString)
      else {
        promise.reject(
          "E_HEALTHKIT_INVALID_INPUT",
          "Missing or invalid startDate."
        )
        return
      }

      let endDate: Date? = (input["endDate"] as? String).flatMap(self.parseISODate)
      let includeHeartRate = (input["includeHeartRate"] as? Bool) ?? false
      let limit = (input["limit"] as? NSNumber)?.intValue ?? 200

      let predicate = HKQuery.predicateForSamples(
        withStart: startDate,
        end: endDate,
        options: [.strictStartDate]
      )

      let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

      let query = HKSampleQuery(
        sampleType: HKObjectType.workoutType(),
        predicate: predicate,
        limit: limit,
        sortDescriptors: [sort]
      ) { [weak self] _, samples, error in
        guard let self = self else { return }

        if let error = error {
          promise.reject("E_HEALTHKIT_QUERY", error.localizedDescription)
          return
        }

        let workouts = (samples as? [HKWorkout]) ?? []
        let initialResults = workouts.map { self.serializeWorkout($0) }

        guard includeHeartRate, !workouts.isEmpty else {
          promise.resolve(initialResults)
          return
        }

        self.attachHeartRateStats(workouts: workouts, initialResults: initialResults) { results in
          promise.resolve(results)
        }
      }

      self.healthStore.execute(query)
    }
  }

  private func attachHeartRateStats(
    workouts: [HKWorkout],
    initialResults: [[String: Any]],
    completion: @escaping ([[String: Any]]) -> Void
  ) {
    guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
      completion(initialResults)
      return
    }

    let maxQueries = min(workouts.count, 50)
    let updateQueue = DispatchQueue(label: "PushPullAppleHealthKit.heartRateUpdate")
    let resultsBox = ResultsBox(initialResults)
    let group = DispatchGroup()

    for index in 0..<maxQueries {
      let workout = workouts[index]

      group.enter()

      let predicate = HKQuery.predicateForSamples(
        withStart: workout.startDate,
        end: workout.endDate,
        options: [.strictStartDate, .strictEndDate]
      )

      let statsQuery = HKStatisticsQuery(
        quantityType: heartRateType,
        quantitySamplePredicate: predicate,
        options: [.discreteAverage, .discreteMax]
      ) { [weak self] _, statistics, _ in
        guard let self = self else {
          group.leave()
          return
        }

        let avg = statistics?.averageQuantity()?.doubleValue(for: self.heartRateUnit)
        let max = statistics?.maximumQuantity()?.doubleValue(for: self.heartRateUnit)

        updateQueue.async {
          if let avg = avg {
            resultsBox.value[index]["avgHeartRate"] = avg
            resultsBox.value[index]["averageHeartRate"] = avg
          }
          if let max = max {
            resultsBox.value[index]["maxHeartRate"] = max
          }
          group.leave()
        }
      }

      healthStore.execute(statsQuery)
    }

    group.notify(queue: DispatchQueue.global(qos: .utility)) {
      completion(resultsBox.value)
    }
  }

  private func serializeWorkout(_ workout: HKWorkout) -> [String: Any] {
    var dict: [String: Any] = [
      "uuid": workout.uuid.uuidString,
      "startDate": formatISODate(workout.startDate),
      "endDate": formatISODate(workout.endDate),
      "duration": workout.duration,
      "sourceName": workout.sourceRevision.source.name,
    ]

    let activityName = workoutActivityName(workout.workoutActivityType)
    dict["workoutActivityType"] = activityName
    dict["activityName"] = activityName

    if let energy = workout.totalEnergyBurned?.doubleValue(for: energyUnit) {
      dict["totalEnergyBurned"] = energy
      dict["energyBurned"] = energy
    }

    return dict
  }

  private func workoutActivityName(_ type: HKWorkoutActivityType) -> String {
    switch type {
    case .running: return "running"
    case .walking: return "walking"
    case .cycling: return "cycling"
    case .swimming: return "swimming"
    case .rowing: return "rowing"
    case .elliptical: return "elliptical"
    case .traditionalStrengthTraining: return "strength_training"
    case .functionalStrengthTraining: return "functional_strength_training"
    case .highIntensityIntervalTraining: return "hiit"
    case .yoga: return "yoga"
    case .pilates: return "pilates"
    case .hiking: return "hiking"
    case .stairClimbing: return "stair_climbing"
    case .mindAndBody: return "mind_and_body"
    default:
      return "workout_\\(type.rawValue)"
    }
  }

  private func parseISODate(_ input: String) -> Date? {
    isoFormatterWithFractionalSeconds.date(from: input) ?? isoFormatter.date(from: input)
  }

  private func formatISODate(_ date: Date) -> String {
    isoFormatterWithFractionalSeconds.string(from: date)
  }
}
