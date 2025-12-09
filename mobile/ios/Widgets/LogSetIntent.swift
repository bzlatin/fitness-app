//
//  LogSetIntent.swift
//  Widgets
//
//  App Intent for logging a set from Live Activity without opening the app
//

import Foundation
import AppIntents
import ActivityKit

@available(iOS 16.0, *)
struct LogSetIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Set"
    static var description = IntentDescription("Logs the current set and starts rest timer")

    // Configuration for Live Activity button
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false // Don't show in Shortcuts app
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

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

        // DO NOT update Live Activity here - let React Native handle it
        // This prevents race conditions where the widget and app both try to update simultaneously
        // The React Native app will update the Live Activity when it processes the pending action

        return .result()
    }
}
