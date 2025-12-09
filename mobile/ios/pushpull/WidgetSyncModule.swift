//
//  WidgetSyncModule.swift
//  pushpull
//
//  React Native bridge module for syncing data to iOS widgets via App Groups
//

import Foundation
import React
#if canImport(WidgetKit)
import WidgetKit
#endif

@objc(WidgetSyncModule)
class WidgetSyncModule: NSObject {

  private let appGroupId = "group.com.pushpull.app"

  // MARK: - Sync Widget Data

  @objc
  func syncWidgetData(_ data: NSDictionary) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      print("❌ Failed to access App Group UserDefaults with suite: \(appGroupId)")
      return
    }

    // Sync each field if present in the data dictionary
    if let weeklyGoal = data["weeklyGoal"] as? Int {
      userDefaults.set(weeklyGoal, forKey: "widget_weeklyGoal")
    }

    if let currentProgress = data["currentProgress"] as? Int {
      userDefaults.set(currentProgress, forKey: "widget_currentProgress")
    }

    if let userName = data["userName"] {
      if let name = userName as? String {
        userDefaults.set(name, forKey: "widget_userName")
      } else {
        // Handle null case (user cleared their name)
        userDefaults.removeObject(forKey: "widget_userName")
      }
    }

    if let userHandle = data["userHandle"] {
      if let handle = userHandle as? String {
        userDefaults.set(handle, forKey: "widget_userHandle")
      } else {
        userDefaults.removeObject(forKey: "widget_userHandle")
      }
    }

    if let authToken = data["authToken"] {
      if let token = authToken as? String {
        userDefaults.set(token, forKey: "widget_authToken")
      } else {
        // Handle logout case (null token)
        userDefaults.removeObject(forKey: "widget_authToken")
      }
    }

    if let apiBaseURL = data["apiBaseURL"] as? String {
      userDefaults.set(apiBaseURL, forKey: "widget_apiBaseURL")
    }

    if let currentStreak = data["currentStreak"] as? Int {
      userDefaults.set(currentStreak, forKey: "widget_currentStreak")
    }

    // Active session data for Quick Set Logger widget
    if let activeSessionId = data["activeSessionId"] {
      if let sessionId = activeSessionId as? String {
        userDefaults.set(sessionId, forKey: "widget_activeSessionId")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionId")
      }
    }

    if let exerciseName = data["activeSessionExerciseName"] {
      if let name = exerciseName as? String {
        userDefaults.set(name, forKey: "widget_activeSessionExerciseName")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionExerciseName")
      }
    }

    if let currentSet = data["activeSessionCurrentSet"] {
      if let setNum = currentSet as? Int {
        userDefaults.set(setNum, forKey: "widget_activeSessionCurrentSet")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionCurrentSet")
      }
    }

    if let totalSets = data["activeSessionTotalSets"] {
      if let total = totalSets as? Int {
        userDefaults.set(total, forKey: "widget_activeSessionTotalSets")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionTotalSets")
      }
    }

    if let lastReps = data["activeSessionLastReps"] {
      if let reps = lastReps as? Int {
        userDefaults.set(reps, forKey: "widget_activeSessionLastReps")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionLastReps")
      }
    }

    if let lastWeight = data["activeSessionLastWeight"] {
      if let weight = lastWeight as? Double {
        userDefaults.set(weight, forKey: "widget_activeSessionLastWeight")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionLastWeight")
      }
    }

    if let targetReps = data["activeSessionTargetReps"] {
      if let reps = targetReps as? Int {
        userDefaults.set(reps, forKey: "widget_activeSessionTargetReps")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionTargetReps")
      }
    }

    if let targetWeight = data["activeSessionTargetWeight"] {
      if let weight = targetWeight as? Double {
        userDefaults.set(weight, forKey: "widget_activeSessionTargetWeight")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionTargetWeight")
      }
    }

    if let startedAt = data["activeSessionStartedAt"] {
      if let timestamp = startedAt as? String {
        userDefaults.set(timestamp, forKey: "widget_activeSessionStartedAt")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionStartedAt")
      }
    }

    // Rest timer data
    if let restDuration = data["activeSessionRestDuration"] {
      if let duration = restDuration as? Int {
        userDefaults.set(duration, forKey: "widget_activeSessionRestDuration")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionRestDuration")
      }
    }

    if let restEndsAt = data["activeSessionRestEndsAt"] {
      if let timestamp = restEndsAt as? String {
        userDefaults.set(timestamp, forKey: "widget_activeSessionRestEndsAt")
      } else {
        userDefaults.removeObject(forKey: "widget_activeSessionRestEndsAt")
      }
    }

    // Set last updated timestamp
    userDefaults.set(Date(), forKey: "widget_lastUpdated")

    // Force synchronize to ensure data is written immediately
    userDefaults.synchronize()

    print("✅ Widget data synced successfully to App Group")

    // Refresh widgets after syncing data
    refreshWidgetsInternal()
  }

  // MARK: - Clear Widget Data

  @objc
  func clearWidgetData() {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      print("❌ Failed to access App Group UserDefaults")
      return
    }

    let keys = [
      "widget_weeklyGoal",
      "widget_currentProgress",
      "widget_userName",
      "widget_userHandle",
      "widget_authToken",
      "widget_apiBaseURL",
      "widget_currentStreak",
      "widget_lastUpdated",
      // Active session keys
      "widget_activeSessionId",
      "widget_activeSessionExerciseName",
      "widget_activeSessionCurrentSet",
      "widget_activeSessionTotalSets",
      "widget_activeSessionLastReps",
      "widget_activeSessionLastWeight",
      "widget_activeSessionTargetReps",
      "widget_activeSessionTargetWeight",
      "widget_activeSessionStartedAt",
      "widget_activeSessionRestDuration",
      "widget_activeSessionRestEndsAt"
    ]

    keys.forEach { userDefaults.removeObject(forKey: $0) }
    userDefaults.synchronize()

    print("✅ Widget data cleared from App Group")

    // Refresh widgets to show logged out state
    refreshWidgetsInternal()
  }

  // MARK: - Read/Write App Group Data (for Live Activity communication)

  @objc
  func writeToAppGroup(_ key: String, value: Any?) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      print("❌ Failed to access App Group UserDefaults")
      return
    }

    if let val = value {
      userDefaults.set(val, forKey: key)
    } else {
      userDefaults.removeObject(forKey: key)
    }

    userDefaults.synchronize()
    print("✅ Wrote to App Group: \(key) = \(value ?? "nil")")
  }

  @objc
  func readFromAppGroup(_ key: String, callback: @escaping RCTResponseSenderBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      print("❌ Failed to access App Group UserDefaults")
      callback([NSNull()])
      return
    }

    let value = userDefaults.object(forKey: key)
    print("📖 Read from App Group: \(key) = \(value ?? "nil")")

    if let val = value {
      callback([val])
    } else {
      callback([NSNull()])
    }
  }

  // MARK: - Refresh Widgets

  @objc
  func refreshWidgets() {
    refreshWidgetsInternal()
  }

  private func refreshWidgetsInternal() {
    #if canImport(WidgetKit)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
      print("📱 WidgetKit timelines reloaded")
    }
    #endif
  }

  // MARK: - React Native Setup

  @objc
  static func requiresMainQueueSetup() -> Bool {
    // This module doesn't need to be initialized on the main thread
    return false
  }
}
