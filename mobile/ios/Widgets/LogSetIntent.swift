//
//  LogSetIntent.swift
//  Widgets
//
//  App Intent for logging a set from Live Activity without opening the app
//

import Foundation
import AppIntents
import ActivityKit

// MARK: - Log Set Intent for Live Activity Buttons

@available(iOS 17.0, *)
struct LogSetIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Log Set"
    static var description = IntentDescription("Logs the current set and starts rest timer")

    // Configuration for Live Activity button
    static var isDiscoverable: Bool = false // Don't show in Shortcuts app

    @Parameter(title: "Session ID")
    var sessionId: String

    init() {
        self.sessionId = ""
    }

    init(sessionId: String) {
        self.sessionId = sessionId
    }

    func perform() async throws -> some IntentResult {
        NSLog("🟢 [LogSetIntent] === INTENT TRIGGERED === for session: \(sessionId)")

        let appGroupId = "group.com.pushpull.app"
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            NSLog("❌ [LogSetIntent] Failed to access App Group UserDefaults")
            return .result()
        }

        // Store the log set action with timestamp for the app to process
        let timestamp = Date().timeIntervalSince1970
        userDefaults.set(sessionId, forKey: "pendingLogSetSessionId")
        userDefaults.set(timestamp, forKey: "pendingLogSetTimestamp")
        userDefaults.synchronize()

        NSLog("✅ [LogSetIntent] Stored pending log set - sessionId: \(sessionId), timestamp: \(timestamp)")

        // Update the Live Activity immediately to show rest timer starting
        // This provides instant feedback even if the app is in the background
        await updateLiveActivityWithRestTimer(userDefaults: userDefaults)

        return .result()
    }

    private func updateLiveActivityWithRestTimer(userDefaults: UserDefaults) async {
        // Find the active workout Live Activity
        let activities = Activity<WorkoutActivityAttributes>.activities
        guard let activity = activities.first(where: { $0.contentState.sessionId == sessionId }) else {
            NSLog("⚠️ [LogSetIntent] No active Live Activity found for session: \(sessionId)")
            return
        }

        let currentState = activity.contentState

        // Read rest duration from App Group (synced by React Native)
        // Key is prefixed with "widget_" by WidgetSyncModule
        // Default to 90 seconds if not set
        let restDuration = userDefaults.integer(forKey: "widget_activeSessionRestDuration")
        let effectiveRestDuration = restDuration > 0 ? restDuration : 90

        // Calculate rest end time
        let restEndTime = Date().addingTimeInterval(TimeInterval(effectiveRestDuration))

        // Read current set info to increment
        let currentSet = currentState.currentSet
        let totalSets = currentState.totalSets
        let nextSet = min(currentSet + 1, totalSets)

        // Get target reps/weight for the current set (already logged)
        let targetReps = currentState.targetReps
        let targetWeight = currentState.targetWeight

        // Create updated state with rest timer and incremented set
        let updatedState = WorkoutActivityAttributes.ContentState(
            exerciseName: currentState.exerciseName,
            currentSet: nextSet,
            totalSets: totalSets,
            lastReps: targetReps,           // The set just logged becomes "last"
            lastWeight: targetWeight,
            targetReps: targetReps,          // Keep same target for next set
            targetWeight: targetWeight,
            restEndTime: restEndTime,
            restDuration: effectiveRestDuration,
            sessionId: currentState.sessionId,
            startTime: currentState.startTime,
            totalExercises: currentState.totalExercises,
            completedExercises: currentState.completedExercises
        )

        await activity.update(using: updatedState)
        NSLog("✅ [LogSetIntent] Live Activity updated - rest timer started for \(effectiveRestDuration)s, moved to set \(nextSet)/\(totalSets)")
    }
}
