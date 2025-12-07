import Foundation
import WidgetKit

/**
 * Widget Data Models
 */
struct WidgetData: Codable {
    let weeklyGoal: Int
    let currentProgress: Int
    let userName: String?
    let userHandle: String?
    let currentStreak: Int
    let lastWorkoutDate: String?
}

struct WidgetEntry: TimelineEntry {
    let date: Date
    let weeklyGoal: Int
    let currentProgress: Int
    let userName: String?
    let userHandle: String?
    let currentStreak: Int
    let lastWorkoutDate: Date?
    let isPlaceholder: Bool
}

/**
 * Widget Data Provider
 * Fetches data from API or App Group cache
 */
class WidgetDataProvider {
    static let shared = WidgetDataProvider()

    private init() {}

    /**
     * Fetch widget data from API or cache
     */
    func fetchData(completion: @escaping (WidgetEntry) -> Void) {
        // Try to fetch from API first
        fetchFromAPI { apiData in
            if let apiData = apiData {
                // Cache the data
                self.cacheData(apiData)
                completion(self.createEntry(from: apiData))
            } else {
                // Fallback to cached data
                completion(self.createEntryFromCache())
            }
        }
    }

    /**
     * Fetch data from API endpoint
     */
    private func fetchFromAPI(completion: @escaping (WidgetData?) -> Void) {
        guard let token = AppGroupUserDefaults.getAuthToken(),
              !token.isEmpty else {
            print("⚠️ No auth token available for widget")
            completion(nil)
            return
        }

        let baseURL = AppGroupUserDefaults.getAPIBaseURL()
        guard let url = URL(string: "\(baseURL)/engagement/widget-data") else {
            completion(nil)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10 // 10 second timeout

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ Widget API error: \(error.localizedDescription)")
                completion(nil)
                return
            }

            guard let data = data else {
                print("❌ No data received from widget API")
                completion(nil)
                return
            }

            // Debug: Print response
            if let httpResponse = response as? HTTPURLResponse {
                print("📡 Widget API response status: \(httpResponse.statusCode)")
            }

            do {
                let decoder = JSONDecoder()
                let widgetData = try decoder.decode(WidgetData.self, from: data)
                print("✅ Widget data fetched successfully")
                completion(widgetData)
            } catch {
                print("❌ Failed to decode widget data: \(error)")
                completion(nil)
            }
        }.resume()
    }

    /**
     * Cache widget data to App Group UserDefaults
     */
    private func cacheData(_ data: WidgetData) {
        AppGroupUserDefaults.setWeeklyGoal(data.weeklyGoal)
        AppGroupUserDefaults.setCurrentProgress(data.currentProgress)
        AppGroupUserDefaults.setUserName(data.userName)
        AppGroupUserDefaults.setUserHandle(data.userHandle)
        AppGroupUserDefaults.setCurrentStreak(data.currentStreak)
    }

    /**
     * Create WidgetEntry from API data
     */
    private func createEntry(from data: WidgetData) -> WidgetEntry {
        let lastWorkoutDate: Date?
        if let dateString = data.lastWorkoutDate {
            let formatter = ISO8601DateFormatter()
            lastWorkoutDate = formatter.date(from: dateString)
        } else {
            lastWorkoutDate = nil
        }

        return WidgetEntry(
            date: Date(),
            weeklyGoal: data.weeklyGoal,
            currentProgress: data.currentProgress,
            userName: data.userName,
            userHandle: data.userHandle,
            currentStreak: data.currentStreak,
            lastWorkoutDate: lastWorkoutDate,
            isPlaceholder: false
        )
    }

    /**
     * Create WidgetEntry from cached data (fallback)
     */
    private func createEntryFromCache() -> WidgetEntry {
        return WidgetEntry(
            date: Date(),
            weeklyGoal: AppGroupUserDefaults.getWeeklyGoal(),
            currentProgress: AppGroupUserDefaults.getCurrentProgress(),
            userName: AppGroupUserDefaults.getUserName(),
            userHandle: AppGroupUserDefaults.getUserHandle(),
            currentStreak: AppGroupUserDefaults.getCurrentStreak(),
            lastWorkoutDate: AppGroupUserDefaults.getLastUpdated(),
            isPlaceholder: false
        )
    }

    /**
     * Create placeholder entry for widget preview
     */
    func createPlaceholder() -> WidgetEntry {
        return WidgetEntry(
            date: Date(),
            weeklyGoal: 4,
            currentProgress: 2,
            userName: "Your Name",
            userHandle: "@yourhandle",
            currentStreak: 5,
            lastWorkoutDate: Date(),
            isPlaceholder: true
        )
    }
}

/**
 * Timeline Provider for WidgetKit
 */
struct WidgetTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        return WidgetDataProvider.shared.createPlaceholder()
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        if context.isPreview {
            completion(WidgetDataProvider.shared.createPlaceholder())
        } else {
            WidgetDataProvider.shared.fetchData(completion: completion)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        WidgetDataProvider.shared.fetchData { entry in
            // Refresh widget every 30 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}
