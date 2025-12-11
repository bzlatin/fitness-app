//
//  LiveActivityModule.swift
//  pushpull
//
//  React Native bridge module for managing Live Activities
//  Starts/updates/ends workout Live Activities from JavaScript
//

import Foundation
import React
import ActivityKit

@objc(LiveActivityModule)
class LiveActivityModule: RCTEventEmitter {

  // Store as Any to avoid @available restriction on stored properties
  private var _currentActivity: Any?

  @available(iOS 16.1, *)
  private var currentActivity: Activity<WorkoutActivityAttributes>? {
    get { _currentActivity as? Activity<WorkoutActivityAttributes> }
    set { _currentActivity = newValue }
  }

  override init() {
    super.init()
    // Listen for log set notifications from Live Activity
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleLogSetIntent(_:)),
      name: NSNotification.Name("LogSetFromLiveActivity"),
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc func handleLogSetIntent(_ notification: Notification) {
    guard let sessionId = notification.userInfo?["sessionId"] as? String else {
      return
    }

    print("✅ [LiveActivity] Log set intent received for session: \(sessionId)")

    // Send event to React Native
    sendEvent(withName: "onLogSetFromLiveActivity", body: ["sessionId": sessionId])
  }

  override func supportedEvents() -> [String]! {
    return ["onLogSetFromLiveActivity"]
  }

  // MARK: - Start Live Activity

  @available(iOS 16.1, *)
  @objc
  func startWorkoutActivity(_ params: NSDictionary) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      print("❌ Live Activities are not enabled")
      return
    }

    // Extract parameters
    guard let sessionId = params["sessionId"] as? String,
          let templateName = params["templateName"] as? String,
          let exerciseName = params["exerciseName"] as? String,
          let currentSet = params["currentSet"] as? Int,
          let totalSets = params["totalSets"] as? Int,
          let totalExercises = params["totalExercises"] as? Int else {
      print("❌ Missing required parameters for Live Activity")
      return
    }

    let targetReps = params["targetReps"] as? Int
    let targetWeight = params["targetWeight"] as? Double
    let completedExercises = params["completedExercises"] as? Int ?? 0

    // Create attributes (static data)
    let attributes = WorkoutActivityAttributes(templateName: templateName)

    // Create initial state
    let initialState = WorkoutActivityAttributes.ContentState(
      exerciseName: exerciseName,
      currentSet: currentSet,
      totalSets: totalSets,
      lastReps: nil,
      lastWeight: nil,
      targetReps: targetReps,
      targetWeight: targetWeight,
      restEndTime: nil,
      restDuration: nil,
      sessionId: sessionId,
      startTime: Date(),
      totalExercises: totalExercises,
      completedExercises: completedExercises
    )

    do {
      // Start the Live Activity
      let activity = try Activity<WorkoutActivityAttributes>.request(
        attributes: attributes,
        contentState: initialState,
        pushType: nil
      )

      currentActivity = activity
      print("✅ Live Activity started: \(activity.id)")
    } catch {
      print("❌ Failed to start Live Activity: \(error.localizedDescription)")
    }
  }

  // MARK: - Update Live Activity

  @available(iOS 16.1, *)
  @objc
  func updateWorkoutActivity(_ params: NSDictionary) {
    guard let activity = currentActivity else {
      print("⚠️ No active Live Activity to update")
      return
    }

    // Get current state
    let currentState = activity.contentState

    // Extract update parameters
    let exerciseName = params["exerciseName"] as? String
    let currentSet = params["currentSet"] as? Int
    let totalSets = params["totalSets"] as? Int
    let lastReps = params["lastReps"] as? Int
    let lastWeight = params["lastWeight"] as? Double
    let targetReps = params["targetReps"] as? Int
    let targetWeight = params["targetWeight"] as? Double
    let completedExercises = params["completedExercises"] as? Int

    // Check if restEndsAt timestamp is provided (preferred method)
    let restEndsAtString = params["restEndsAt"] as? String
    let restDuration = params["restDuration"] as? Int
    let shouldClearRestTimer = params.allKeys.contains { ($0 as? String) == "restDuration" }

    // Calculate rest end time
    var restEndTime: Date? = nil

    // Priority 1: Use explicit restEndsAt timestamp if provided
    if let restEndsAtStr = restEndsAtString {
      let formatter = ISO8601DateFormatter()
      // First try with fractional seconds (JavaScript's toISOString format)
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      if let parsedDate = formatter.date(from: restEndsAtStr) {
        restEndTime = parsedDate
        print("🔵 [LiveActivity] Using provided restEndsAt timestamp: \(restEndTime!)")
      } else {
        // Fallback to standard ISO8601 without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let parsedDate = formatter.date(from: restEndsAtStr) {
          restEndTime = parsedDate
          print("🔵 [LiveActivity] Using provided restEndsAt timestamp (no ms): \(restEndTime!)")
        }
      }
    }
    // Priority 2: If restDuration is provided but no timestamp
    else if shouldClearRestTimer {
      if let duration = restDuration, duration > 0 {
        // Only create a NEW timer if there isn't an existing valid one
        // This prevents the timer from resetting on every update
        if let existingRestEndTime = currentState.restEndTime, existingRestEndTime > Date() {
          restEndTime = existingRestEndTime
          print("🔵 [LiveActivity] Keeping existing rest timer: \(restEndTime!)")
        } else {
          restEndTime = Date().addingTimeInterval(TimeInterval(duration))
          print("🔵 [LiveActivity] Setting NEW rest timer to \(duration) seconds, endTime: \(restEndTime!)")
        }
      } else {
        restEndTime = nil // Clear the timer
        print("🔵 [LiveActivity] Clearing rest timer (restDuration was nil/0)")
      }
    }
    // Priority 3: Keep existing timer if no rest-related params provided
    else {
      restEndTime = currentState.restEndTime
      print("🔵 [LiveActivity] Keeping existing rest timer: \(restEndTime?.description ?? "none")")
    }

    // Create updated state (only update provided fields)
    let updatedState = WorkoutActivityAttributes.ContentState(
      exerciseName: exerciseName ?? currentState.exerciseName,
      currentSet: currentSet ?? currentState.currentSet,
      totalSets: totalSets ?? currentState.totalSets,
      lastReps: lastReps ?? currentState.lastReps,
      lastWeight: lastWeight ?? currentState.lastWeight,
      targetReps: targetReps ?? currentState.targetReps,
      targetWeight: targetWeight ?? currentState.targetWeight,
      restEndTime: restEndTime,
      restDuration: shouldClearRestTimer ? restDuration : currentState.restDuration,
      sessionId: currentState.sessionId,
      startTime: currentState.startTime,
      totalExercises: currentState.totalExercises,
      completedExercises: completedExercises ?? currentState.completedExercises
    )

    Task {
      await activity.update(using: updatedState)
      print("✅ Live Activity updated")
    }
  }

  // MARK: - End Live Activity

  @available(iOS 16.1, *)
  @objc
  func endWorkoutActivity() {
    guard let activity = currentActivity else {
      print("⚠️ No active Live Activity to end")
      return
    }

    Task {
      await activity.end(dismissalPolicy: .immediate)
      currentActivity = nil
      print("✅ Live Activity ended")
    }
  }

  // MARK: - End with Final State

  @available(iOS 16.1, *)
  @objc
  func endWorkoutActivityWithSummary(_ params: NSDictionary) {
    guard let activity = currentActivity else {
      print("⚠️ No active Live Activity to end")
      return
    }

    let totalSets = params["totalSets"] as? Int ?? 0
    let totalVolume = params["totalVolume"] as? Int ?? 0
    let durationMinutes = params["durationMinutes"] as? Int ?? 0

    // Create final state showing summary
    let finalState = WorkoutActivityAttributes.ContentState(
      exerciseName: "Workout Complete! 🎉",
      currentSet: totalSets,
      totalSets: totalSets,
      lastReps: nil,
      lastWeight: nil,
      targetReps: nil,
      targetWeight: nil,
      restEndTime: nil,
      restDuration: nil,
      sessionId: activity.contentState.sessionId,
      startTime: activity.contentState.startTime,
      totalExercises: activity.contentState.totalExercises,
      completedExercises: activity.contentState.totalExercises
    )

    Task {
      await activity.update(using: finalState)
      // Dismiss after 3 seconds to show completion
      try? await Task.sleep(nanoseconds: 3_000_000_000)
      await activity.end(dismissalPolicy: .immediate)
      currentActivity = nil
      print("✅ Live Activity ended with summary")
    }
  }

  // MARK: - Check if Live Activities are Available

  @objc
  func areLiveActivitiesEnabled(_ callback: RCTResponseSenderBlock) {
    if #available(iOS 16.1, *) {
      let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
      callback([enabled])
    } else {
      callback([false])
    }
  }

  // MARK: - React Native Setup

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
