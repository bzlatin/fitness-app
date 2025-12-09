//
//  WorkoutActivityAttributes.swift
//  Widgets
//
//  Live Activity attributes for active workout sessions
//  Displays in Dynamic Island and Lock Screen
//

import ActivityKit
import Foundation

// MARK: - Workout Activity Attributes

struct WorkoutActivityAttributes: ActivityAttributes {
    // Static data that doesn't change during the activity
    public struct ContentState: Codable, Hashable {
        // Current exercise info
        var exerciseName: String
        var currentSet: Int
        var totalSets: Int

        // Performance tracking
        var lastReps: Int?
        var lastWeight: Double?
        var targetReps: Int?
        var targetWeight: Double?

        // Rest timer
        var restEndTime: Date?
        var restDuration: Int?

        // Session metadata
        var sessionId: String
        var startTime: Date
        var totalExercises: Int
        var completedExercises: Int
    }

    // Static attributes (don't change)
    var templateName: String
}
