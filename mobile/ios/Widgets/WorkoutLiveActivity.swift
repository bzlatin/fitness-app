//
//  WorkoutLiveActivity.swift
//  Widgets
//
//  Live Activity UI for active workout sessions
//  Shows in Dynamic Island and Lock Screen
//

import ActivityKit
import WidgetKit
import SwiftUI
import AppIntents
import Combine

// MARK: - Live Activity Widget

@available(iOS 16.1, *)
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // Lock Screen / Banner UI
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.exerciseName)
                            .font(.headline)
                            .foregroundColor(.white)

                        Text("Set \(context.state.currentSet)/\(context.state.totalSets)")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    // Only show timer if it hasn't expired yet
                    if let restEndTime = context.state.restEndTime, restEndTime > Date() {
                        RestTimerView(endTime: restEndTime)
                    } else {
                        VStack(alignment: .trailing, spacing: 4) {
                            if let targetReps = context.state.targetReps {
                                Text("\(targetReps) reps")
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                            if let targetWeight = context.state.targetWeight {
                                Text(formatWeight(targetWeight))
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                            }
                        }
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 12) {
                        // Last set performance
                        if let lastReps = context.state.lastReps,
                           let lastWeight = context.state.lastWeight {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Last Set")
                                    .font(.caption2)
                                    .foregroundColor(.gray)

                                Text("\(lastReps) reps @ \(formatWeight(lastWeight))")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                        }

                        Spacer()

                        // Workout progress
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(context.state.completedExercises)/\(context.state.totalExercises) exercises")
                                .font(.caption2)
                                .foregroundColor(.gray)

                            Text(elapsedTime(from: context.state.startTime))
                                .font(.caption)
                                .foregroundColor(.white)
                        }
                    }
                    .padding(.top, 8)
                }

            } compactLeading: {
                // Compact leading (left side of Dynamic Island)
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(.green)
            } compactTrailing: {
                // Compact trailing (right side of Dynamic Island)
                // Only show timer if it hasn't expired yet
                if let restEndTime = context.state.restEndTime, restEndTime > Date() {
                    TimerText(endTime: restEndTime)
                        .font(.caption2)
                        .foregroundColor(.orange)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 40)
                        .monospacedDigit()
                } else {
                    Text("Set \(context.state.currentSet)")
                        .font(.caption2)
                        .foregroundColor(.white)
                }
            } minimal: {
                // Minimal view (when multiple activities)
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(.green)
            }
        }
    }

    private func formatWeight(_ weight: Double) -> String {
        if weight.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(weight)) lbs"
        } else {
            return String(format: "%.1f lbs", weight)
        }
    }

    private func elapsedTime(from startTime: Date) -> String {
        let elapsed = Int(Date().timeIntervalSince(startTime))
        let minutes = elapsed / 60
        let seconds = elapsed % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Lock Screen View

@available(iOS 16.1, *)
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<WorkoutActivityAttributes>

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack(spacing: 12) {
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(.green)

                Text(context.attributes.templateName)
                    .font(.caption)
                    .foregroundColor(.gray)
            }

            // Current Exercise + Set/Rest Info
            let restActive = context.state.restEndTime.map { $0 > Date() } ?? false

            HStack(alignment: .center, spacing: 12) {
                // Exercise name (always visible)
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.exerciseName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                }

                Spacer()

                // Right side - Rest timer (if active) or Set number
                if restActive, let restEndTime = context.state.restEndTime {
                    // Rest timer is active - show with green highlight
                    HStack(spacing: 8) {
                        Image(systemName: "timer")
                            .font(.caption)
                            .foregroundColor(.green)

                        TimerText(endTime: restEndTime)
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.green, lineWidth: 2)
                    )
                } else {
                    // No active rest timer - show current set with green highlight
                    HStack(spacing: 6) {
                        Image(systemName: "dumbbell.fill")
                            .font(.caption)
                            .foregroundColor(.green)

                        Text("Set \(context.state.currentSet)")
                            .font(.subheadline)
                            .fontWeight(.bold)
                            .foregroundColor(.white)

                        Text("of \(context.state.totalSets)")
                            .font(.caption)
                            .foregroundColor(.gray)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.green, lineWidth: 2)
                    )
                }
            }

            // Last set performance (hide during active rest timer)
            if !restActive {
                if let lastReps = context.state.lastReps,
                   let lastWeight = context.state.lastWeight {
                    HStack {
                        Text("Last set:")
                            .font(.caption2)
                            .foregroundColor(.gray)

                        Text("\(lastReps) reps @ \(formatWeight(lastWeight))")
                            .font(.caption)
                            .foregroundColor(.green)

                        Spacer()
                    }
                }
            }

            // Progress bar
            ProgressView(value: Double(context.state.completedExercises), total: Double(context.state.totalExercises))
                .tint(.green)

            // Log Set Button (show when rest timer expired or not resting)
            if !restActive {
                Link(destination: URL(string: "push-pull://workout/log-set?sessionId=\(context.state.sessionId)")!) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 16))

                        Text("Log Set")
                            .font(.system(.subheadline, design: .rounded))
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.green)
                    .cornerRadius(10)
                }
            }
        }
        .padding(16)
        .activityBackgroundTint(Color(red: 5/255, green: 8/255, blue: 22/255))
        .activitySystemActionForegroundColor(.white)
    }

    private func formatWeight(_ weight: Double) -> String {
        if weight.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(weight)) lbs"
        } else {
            return String(format: "%.1f lbs", weight)
        }
    }

    private func elapsedTime(from startTime: Date) -> String {
        let elapsed = Int(Date().timeIntervalSince(startTime))
        let minutes = elapsed / 60
        let seconds = elapsed % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Timer Text View for Live Activities
// Uses SwiftUI's native countdown which works in Live Activities without needing Timer.publish

@available(iOS 16.1, *)
struct TimerText: View {
    let endTime: Date

    var body: some View {
        // Use SwiftUI's native timer style - this works in Live Activities
        // It automatically counts down to the target date
        if endTime > Date() {
            Text(endTime, style: .timer)
        } else {
            Text("0:00")
        }
    }
}

// MARK: - Rest Timer View for Dynamic Island Expanded Region
// Uses SwiftUI's native countdown which works in Live Activities

@available(iOS 16.1, *)
struct RestTimerView: View {
    let endTime: Date

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("Rest")
                .font(.caption2)
                .foregroundColor(.orange)

            if endTime > Date() {
                Text(endTime, style: .timer)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.orange)
                    .monospacedDigit()
            } else {
                Text("0:00")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.orange)
                    .monospacedDigit()
            }
        }
    }
}

// MARK: - Preview

@available(iOS 16.1, *)
struct WorkoutLiveActivity_Previews: PreviewProvider {
    static let attributes = WorkoutActivityAttributes(templateName: "Push Day")
    static let contentState = WorkoutActivityAttributes.ContentState(
        exerciseName: "Bench Press",
        currentSet: 3,
        totalSets: 4,
        lastReps: 8,
        lastWeight: 185.0,
        targetReps: 8,
        targetWeight: 185.0,
        restEndTime: Date().addingTimeInterval(60),
        restDuration: 90,
        sessionId: "preview-session",
        startTime: Date().addingTimeInterval(-600),
        totalExercises: 5,
        completedExercises: 2
    )

    static var previews: some View {
        attributes
            .previewContext(contentState, viewKind: .dynamicIsland(.compact))
            .previewDisplayName("Compact")

        attributes
            .previewContext(contentState, viewKind: .dynamicIsland(.expanded))
            .previewDisplayName("Expanded")

        attributes
            .previewContext(contentState, viewKind: .content)
            .previewDisplayName("Lock Screen")
    }
}
