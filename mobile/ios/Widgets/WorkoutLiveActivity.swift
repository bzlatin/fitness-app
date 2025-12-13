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
                    if let restEndTime = context.state.restEndTime {
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
                if let restEndTime = context.state.restEndTime {
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
        let restActive = context.state.restEndTime != nil

        VStack(spacing: 12) {
            // Row 1: Exercise name + Resting/Set info
            HStack(alignment: .center) {
                // Left: Exercise name (takes available space)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.exerciseName)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Text("\(context.state.currentSet)/\(context.state.totalSets) sets")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer(minLength: 12)

                // Right: Timer or status
                if restActive, let restEndTime = context.state.restEndTime {
                    HStack(spacing: 6) {
                        Text("Resting")
                            .font(.caption2)
                            .foregroundColor(.green)

                        TimerText(endTime: restEndTime)
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(10)
                } else {
                    // Show target reps
                    if let targetReps = context.state.targetReps {
                        VStack(alignment: .trailing, spacing: 0) {
                            Text("\(targetReps) reps")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(.white)

                            if let weight = context.state.targetWeight, weight > 0 {
                                Text(formatWeight(weight))
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                }
            }

            // Row 2: Progress + Last set
            HStack {
                Text("\(context.state.completedExercises)/\(context.state.totalExercises) exercises")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                if let lastReps = context.state.lastReps,
                   let lastWeight = context.state.lastWeight {
                    Text("Last: \(lastReps) × \(formatWeight(lastWeight))")
                        .font(.caption2)
                        .foregroundColor(.green)
                }
            }

            // Row 3: Progress bar
            ProgressView(value: Double(context.state.completedExercises), total: Double(max(context.state.totalExercises, 1)))
                .tint(.green)

            // Row 4: Log Set button (only when not resting)
            if !restActive {
                logSetButton
            }
        }
        .padding(16)
        .activityBackgroundTint(Color(red: 5/255, green: 8/255, blue: 22/255))
        .activitySystemActionForegroundColor(.white)
    }

    private var logSetButton: some View {
        // Use deep link - opens the app to log the set
        Link(destination: URL(string: "push-pull://workout/log-set?sessionId=\(context.state.sessionId)")!) {
            logSetButtonContent
        }
    }

    private var logSetButtonContent: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16))

            Text("Log Set")
                .font(.system(size: 15, weight: .semibold, design: .rounded))
        }
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .frame(minHeight: 44) // Ensure minimum touch target
        .background(Color.green)
        .cornerRadius(10)
        .contentShape(Rectangle()) // Make entire area tappable
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
        // Use timerInterval to show countdown that stops at 0
        // This prevents the timer from counting UP after it expires
        Text(timerInterval: Date()...endTime, countsDown: true, showsHours: false)
            .monospacedDigit()
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

            Text(timerInterval: Date()...endTime, countsDown: true, showsHours: false)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(.orange)
                .monospacedDigit()
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
