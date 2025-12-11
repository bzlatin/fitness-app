//
//  QuickSetLoggerWidget.swift
//  Widgets
//
//  Quick Set Logger Widget for active workout sessions
//

import WidgetKit
import SwiftUI

// MARK: - Widget Entry

struct QuickSetLoggerEntry: TimelineEntry {
    let date: Date
    let hasActiveSession: Bool
    let sessionId: String?
    let exerciseName: String?
    let currentSet: Int?
    let totalSets: Int?
    let lastReps: Int?
    let lastWeight: Double?
    let targetReps: Int?
    let targetWeight: Double?
    let startedAt: String?
    // Rest timer
    let restDuration: Int?
    let restEndsAt: Date?
}

// MARK: - Timeline Provider

struct QuickSetLoggerProvider: TimelineProvider {

    private let appGroupId = "group.com.pushpull.app"

    func placeholder(in context: Context) -> QuickSetLoggerEntry {
        QuickSetLoggerEntry(
            date: Date(),
            hasActiveSession: true,
            sessionId: "demo-session",
            exerciseName: "Bench Press",
            currentSet: 3,
            totalSets: 4,
            lastReps: 8,
            lastWeight: 185,
            targetReps: 8,
            targetWeight: 185,
            startedAt: Date().ISO8601Format(),
            restDuration: 90,
            restEndsAt: Date().addingTimeInterval(60)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickSetLoggerEntry) -> ()) {
        let entry = loadEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickSetLoggerEntry>) -> ()) {
        let entry = loadEntry()

        // Refresh every 30 seconds when session is active, otherwise every 5 minutes
        let refreshInterval: Int = entry.hasActiveSession ? 30 : 300
        let nextUpdate = Calendar.current.date(byAdding: .second, value: refreshInterval, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))

        completion(timeline)
    }

    private func loadEntry() -> QuickSetLoggerEntry {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            // Return empty entry if App Group is not accessible
            return QuickSetLoggerEntry(
                date: Date(),
                hasActiveSession: false,
                sessionId: nil,
                exerciseName: nil,
                currentSet: nil,
                totalSets: nil,
                lastReps: nil,
                lastWeight: nil,
                targetReps: nil,
                targetWeight: nil,
                startedAt: nil,
                restDuration: nil,
                restEndsAt: nil
            )
        }

        // Read active session data from App Group UserDefaults
        let sessionId = userDefaults.string(forKey: "widget_activeSessionId")
        let exerciseName = userDefaults.string(forKey: "widget_activeSessionExerciseName")
        let currentSet = userDefaults.object(forKey: "widget_activeSessionCurrentSet") as? Int
        let totalSets = userDefaults.object(forKey: "widget_activeSessionTotalSets") as? Int
        let lastReps = userDefaults.object(forKey: "widget_activeSessionLastReps") as? Int
        let lastWeight = userDefaults.object(forKey: "widget_activeSessionLastWeight") as? Double
        let targetReps = userDefaults.object(forKey: "widget_activeSessionTargetReps") as? Int
        let targetWeight = userDefaults.object(forKey: "widget_activeSessionTargetWeight") as? Double
        let startedAt = userDefaults.string(forKey: "widget_activeSessionStartedAt")
        let restDuration = userDefaults.object(forKey: "widget_activeSessionRestDuration") as? Int
        let restEndsAtString = userDefaults.string(forKey: "widget_activeSessionRestEndsAt")

        let hasActiveSession = sessionId != nil && !sessionId!.isEmpty

        // Parse restEndsAt ISO string to Date
        var restEndsAt: Date? = nil
        if let restEndsAtStr = restEndsAtString {
            // Try standard ISO8601 first
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let parsed = formatter.date(from: restEndsAtStr) {
                restEndsAt = parsed
            } else {
                // Fallback to ISO8601 without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                restEndsAt = formatter.date(from: restEndsAtStr)
            }
        }

        return QuickSetLoggerEntry(
            date: Date(),
            hasActiveSession: hasActiveSession,
            sessionId: sessionId,
            exerciseName: exerciseName,
            currentSet: currentSet,
            totalSets: totalSets,
            lastReps: lastReps,
            lastWeight: lastWeight,
            targetReps: targetReps,
            targetWeight: targetWeight,
            startedAt: startedAt,
            restDuration: restDuration,
            restEndsAt: restEndsAt
        )
    }
}

// MARK: - Widget View

struct QuickSetLoggerWidgetView: View {
    var entry: QuickSetLoggerProvider.Entry
    @Environment(\.widgetFamily) var widgetFamily

    var body: some View {
        if !entry.hasActiveSession {
            noActiveSessionView
        } else {
            activeSessionView
        }
    }

    // MARK: - No Active Session View

    private var noActiveSessionView: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 28))
                .foregroundColor(.gray)

            Text("No Active Workout")
                .font(.caption)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)

            Text("Start a workout to use\nQuick Set Logger")
                .font(.caption2)
                .foregroundColor(Color.gray.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .padding()
        .containerBackground(for: .widget) {
            Color(red: 5/255, green: 8/255, blue: 22/255) // #050816
        }
    }

    // MARK: - Active Session View

    // Check if rest timer is currently active
    private var isRestTimerActive: Bool {
        guard let restEndsAt = entry.restEndsAt else { return false }
        return restEndsAt > Date()
    }

    private var activeSessionView: some View {
        VStack(alignment: .leading, spacing: widgetFamily == .systemSmall ? 8 : 12) {
            // Header
            HStack {
                Image(systemName: "dumbbell.fill")
                    .font(.caption2)
                    .foregroundColor(.green)

                Text("Active Workout")
                    .font(.caption2)
                    .foregroundColor(.gray)

                Spacer()

                // Show rest timer OR set count
                if isRestTimerActive, let restEndsAt = entry.restEndsAt {
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.caption2)
                            .foregroundColor(.orange)

                        Text(restEndsAt, style: .timer)
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.orange)
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.2))
                    .cornerRadius(6)
                } else if let currentSet = entry.currentSet, let totalSets = entry.totalSets {
                    Text("Set \(currentSet)/\(totalSets)")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }
            }

            // Exercise Name
            if let exerciseName = entry.exerciseName {
                Text(exerciseName)
                    .font(widgetFamily == .systemSmall ? .caption : .subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .lineLimit(widgetFamily == .systemSmall ? 2 : 1)
            }

            if widgetFamily == .systemMedium {
                // Rest timer display for medium widget (more prominent)
                if isRestTimerActive, let restEndsAt = entry.restEndsAt {
                    HStack(spacing: 8) {
                        Image(systemName: "timer")
                            .font(.subheadline)
                            .foregroundColor(.orange)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Rest Timer")
                                .font(.caption2)
                                .foregroundColor(.gray)

                            Text(restEndsAt, style: .timer)
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundColor(.orange)
                                .monospacedDigit()
                        }

                        Spacer()

                        if let currentSet = entry.currentSet, let totalSets = entry.totalSets {
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("Next")
                                    .font(.caption2)
                                    .foregroundColor(.gray)

                                Text("Set \(currentSet)/\(totalSets)")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.orange.opacity(0.15))
                    .cornerRadius(10)
                } else {
                    // Last Set Performance (Medium widget only, when not resting)
                    if let lastReps = entry.lastReps, let lastWeight = entry.lastWeight {
                        HStack(spacing: 4) {
                            Text("Last set:")
                                .font(.caption2)
                                .foregroundColor(.gray)

                            Text("\(lastReps) reps @ \(formatWeight(lastWeight))")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                        }
                    }

                    // Target Performance
                    if let targetReps = entry.targetReps, let targetWeight = entry.targetWeight {
                        HStack(spacing: 4) {
                            Text("Target:")
                                .font(.caption2)
                                .foregroundColor(.gray)

                            Text("\(targetReps) reps @ \(formatWeight(targetWeight))")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.blue)
                        }
                    }
                }

                Spacer()

                // Action Button (hide during rest timer)
                if !isRestTimerActive, let sessionId = entry.sessionId {
                    Link(destination: URL(string: "push-pull://workout/log-set?sessionId=\(sessionId)")!) {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)

                            Text("Log Set")
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.green)
                        .cornerRadius(8)
                    }
                }
            } else {
                // Small widget - show compact info
                Spacer()

                // Show rest timer for small widget
                if isRestTimerActive, let restEndsAt = entry.restEndsAt {
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.caption2)
                            .foregroundColor(.orange)

                        Text(restEndsAt, style: .timer)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.orange)
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.orange.opacity(0.2))
                    .cornerRadius(6)
                } else {
                    if let targetReps = entry.targetReps, let targetWeight = entry.targetWeight {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(targetReps) reps")
                                .font(.caption2)
                                .foregroundColor(.gray)

                            Text(formatWeight(targetWeight))
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        }
                    }

                    // Tap to open app and log set
                    if let sessionId = entry.sessionId {
                        Link(destination: URL(string: "push-pull://workout/log-set?sessionId=\(sessionId)")!) {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                    .font(.caption2)

                                Text("Log")
                                    .font(.caption2)
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.green)
                            .cornerRadius(6)
                        }
                    }
                }
            }
        }
        .padding(widgetFamily == .systemSmall ? 12 : 16)
        .containerBackground(for: .widget) {
            Color(red: 5/255, green: 8/255, blue: 22/255)
        }
    }

    // MARK: - Helpers

    private func formatWeight(_ weight: Double) -> String {
        // Remove decimal if it's a whole number
        if weight.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(weight)) lbs"
        } else {
            return String(format: "%.1f lbs", weight)
        }
    }
}

// MARK: - Widget Definition

struct QuickSetLoggerWidget: Widget {
    let kind: String = "QuickSetLoggerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickSetLoggerProvider()) { entry in
            QuickSetLoggerWidgetView(entry: entry)
        }
        .configurationDisplayName("Quick Set Logger")
        .description("Log sets during active workouts")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

struct QuickSetLoggerWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Active session - Small
            QuickSetLoggerWidgetView(entry: QuickSetLoggerEntry(
                date: Date(),
                hasActiveSession: true,
                sessionId: "demo-session",
                exerciseName: "Bench Press",
                currentSet: 3,
                totalSets: 4,
                lastReps: 8,
                lastWeight: 185.0,
                targetReps: 8,
                targetWeight: 185.0,
                startedAt: Date().ISO8601Format(),
                restDuration: nil,
                restEndsAt: nil
            ))
            .previewContext(WidgetPreviewContext(family: .systemSmall))

            // Active session with rest timer - Small
            QuickSetLoggerWidgetView(entry: QuickSetLoggerEntry(
                date: Date(),
                hasActiveSession: true,
                sessionId: "demo-session",
                exerciseName: "Bench Press",
                currentSet: 3,
                totalSets: 4,
                lastReps: 8,
                lastWeight: 185.0,
                targetReps: 8,
                targetWeight: 185.0,
                startedAt: Date().ISO8601Format(),
                restDuration: 90,
                restEndsAt: Date().addingTimeInterval(45)
            ))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
            .previewDisplayName("Small - Rest Timer")

            // Active session - Medium
            QuickSetLoggerWidgetView(entry: QuickSetLoggerEntry(
                date: Date(),
                hasActiveSession: true,
                sessionId: "demo-session",
                exerciseName: "Squat",
                currentSet: 2,
                totalSets: 5,
                lastReps: 10,
                lastWeight: 225.0,
                targetReps: 10,
                targetWeight: 225.0,
                startedAt: Date().ISO8601Format(),
                restDuration: nil,
                restEndsAt: nil
            ))
            .previewContext(WidgetPreviewContext(family: .systemMedium))

            // Active session with rest timer - Medium
            QuickSetLoggerWidgetView(entry: QuickSetLoggerEntry(
                date: Date(),
                hasActiveSession: true,
                sessionId: "demo-session",
                exerciseName: "Squat",
                currentSet: 2,
                totalSets: 5,
                lastReps: 10,
                lastWeight: 225.0,
                targetReps: 10,
                targetWeight: 225.0,
                startedAt: Date().ISO8601Format(),
                restDuration: 90,
                restEndsAt: Date().addingTimeInterval(67)
            ))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
            .previewDisplayName("Medium - Rest Timer")

            // No active session - Small
            QuickSetLoggerWidgetView(entry: QuickSetLoggerEntry(
                date: Date(),
                hasActiveSession: false,
                sessionId: nil,
                exerciseName: nil,
                currentSet: nil,
                totalSets: nil,
                lastReps: nil,
                lastWeight: nil,
                targetReps: nil,
                targetWeight: nil,
                startedAt: nil,
                restDuration: nil,
                restEndsAt: nil
            ))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
        }
    }
}
