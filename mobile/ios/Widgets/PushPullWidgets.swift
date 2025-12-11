//
//  PushPullWidgets.swift
//  Widgets
//
//  Weekly Goal Widget for Push/Pull Fitness App
//

import WidgetKit
import SwiftUI

// MARK: - Widget Entry

struct WeeklyGoalEntry: TimelineEntry {
    let date: Date
    let weeklyGoal: Int
    let currentProgress: Int
    let currentStreak: Int
    let userName: String?
    let isLoggedIn: Bool
}

// MARK: - Timeline Provider

struct WeeklyGoalProvider: TimelineProvider {

    private let appGroupId = "group.com.pushpull.app"

    func placeholder(in context: Context) -> WeeklyGoalEntry {
        WeeklyGoalEntry(
            date: Date(),
            weeklyGoal: 4,
            currentProgress: 2,
            currentStreak: 5,
            userName: nil,
            isLoggedIn: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WeeklyGoalEntry) -> ()) {
        let entry = loadEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeeklyGoalEntry>) -> ()) {
        let entry = loadEntry()

        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))

        completion(timeline)
    }

    private func loadEntry() -> WeeklyGoalEntry {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            // Return default entry if App Group is not accessible
            return WeeklyGoalEntry(
                date: Date(),
                weeklyGoal: 4,
                currentProgress: 0,
                currentStreak: 0,
                userName: nil,
                isLoggedIn: false
            )
        }

        // Read data from App Group UserDefaults (synced from main app)
        let weeklyGoal = userDefaults.integer(forKey: "widget_weeklyGoal")
        let currentProgress = userDefaults.integer(forKey: "widget_currentProgress")
        let currentStreak = userDefaults.integer(forKey: "widget_currentStreak")
        let userName = userDefaults.string(forKey: "widget_userName")
        let authToken = userDefaults.string(forKey: "widget_authToken")

        let isLoggedIn = authToken != nil && !authToken!.isEmpty

        return WeeklyGoalEntry(
            date: Date(),
            weeklyGoal: weeklyGoal > 0 ? weeklyGoal : 4,
            currentProgress: currentProgress,
            currentStreak: currentStreak,
            userName: userName,
            isLoggedIn: isLoggedIn
        )
    }
}

// MARK: - Widget View

struct WeeklyGoalWidgetView: View {
    var entry: WeeklyGoalProvider.Entry
    @Environment(\.widgetFamily) var widgetFamily

    var body: some View {
        if !entry.isLoggedIn {
            loggedOutView
        } else {
            switch widgetFamily {
            case .systemSmall:
                smallWidgetView
            case .systemMedium:
                mediumWidgetView
            default:
                smallWidgetView
            }
        }
    }

    // MARK: - Logged Out View

    private var loggedOutView: some View {
        VStack(spacing: 8) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 32))
                .foregroundColor(.green)

            Text("Push/Pull")
                .font(.headline)
                .foregroundColor(.white)

            Text("Open app to login")
                .font(.caption)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .padding()
        .containerBackground(for: .widget) {
            Color(red: 5/255, green: 8/255, blue: 22/255) // #050816
        }
    }

    // MARK: - Small Widget (Progress Ring)

    private var smallWidgetView: some View {
        VStack(spacing: 12) {
            Text("Weekly Goal")
                .font(.caption)
                .foregroundColor(.gray)

            ZStack {
                // Background circle
                Circle()
                    .stroke(Color.gray.opacity(0.3), lineWidth: 8)
                    .frame(width: 80, height: 80)

                // Progress circle
                Circle()
                    .trim(from: 0, to: progressFraction)
                    .stroke(progressColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut, value: progressFraction)

                // Progress text
                VStack(spacing: 2) {
                    Text("\(entry.currentProgress)")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)

                    Text("of \(entry.weeklyGoal)")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
            }

            if entry.currentStreak > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .font(.caption2)
                        .foregroundColor(.orange)

                    Text("\(entry.currentStreak) day streak")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
            }
        }
        .padding()
        .containerBackground(for: .widget) {
            Color(red: 5/255, green: 8/255, blue: 22/255)
        }
    }

    // MARK: - Medium Widget (Detailed Stats)

    private var mediumWidgetView: some View {
        HStack(spacing: 16) {
            // Progress Ring
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.3), lineWidth: 8)
                    .frame(width: 80, height: 80)

                Circle()
                    .trim(from: 0, to: progressFraction)
                    .stroke(progressColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))

                VStack(spacing: 2) {
                    Text("\(entry.currentProgress)")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(.white)

                    Text("of \(entry.weeklyGoal)")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
            }

            // Stats
            VStack(alignment: .leading, spacing: 8) {
                if let userName = entry.userName {
                    Text(userName)
                        .font(.headline)
                        .foregroundColor(.white)
                        .lineLimit(1)
                }

                Text("Weekly Goal")
                    .font(.subheadline)
                    .foregroundColor(.gray)

                if entry.currentStreak > 0 {
                    HStack(spacing: 6) {
                        Image(systemName: "flame.fill")
                            .foregroundColor(.orange)

                        Text("\(entry.currentStreak) day streak")
                            .font(.subheadline)
                            .foregroundColor(.white)
                    }
                }

                Text(progressMessage)
                    .font(.caption)
                    .foregroundColor(.gray)
                    .lineLimit(2)
            }

            Spacer()
        }
        .padding()
        .containerBackground(for: .widget) {
            Color(red: 5/255, green: 8/255, blue: 22/255)
        }
    }

    // MARK: - Helpers

    private var progressFraction: Double {
        guard entry.weeklyGoal > 0 else { return 0 }
        return min(Double(entry.currentProgress) / Double(entry.weeklyGoal), 1.0)
    }

    private var progressColor: Color {
        if entry.currentProgress >= entry.weeklyGoal {
            return Color.green
        } else if progressFraction >= 0.5 {
            return Color.blue
        } else {
            return Color.orange
        }
    }

    private var progressMessage: String {
        let remaining = max(0, entry.weeklyGoal - entry.currentProgress)

        if entry.currentProgress >= entry.weeklyGoal {
            return "🎉 Goal crushed!"
        } else if remaining == 1 {
            return "1 more workout to go!"
        } else {
            return "\(remaining) more to reach your goal"
        }
    }
}

// MARK: - Widget Definition

struct PushPullWidgets: Widget {
    let kind: String = "PushPullWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeeklyGoalProvider()) { entry in
            WeeklyGoalWidgetView(entry: entry)
        }
        .configurationDisplayName("Weekly Goal")
        .description("Track your weekly workout progress")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

struct PushPullWidgets_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            WeeklyGoalWidgetView(entry: WeeklyGoalEntry(
                date: Date(),
                weeklyGoal: 4,
                currentProgress: 2,
                currentStreak: 5,
                userName: "John Doe",
                isLoggedIn: true
            ))
            .previewContext(WidgetPreviewContext(family: .systemSmall))

            WeeklyGoalWidgetView(entry: WeeklyGoalEntry(
                date: Date(),
                weeklyGoal: 4,
                currentProgress: 4,
                currentStreak: 10,
                userName: "Jane Smith",
                isLoggedIn: true
            ))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
        }
    }
}
