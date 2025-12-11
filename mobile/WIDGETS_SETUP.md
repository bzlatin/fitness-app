# iOS Widgets Setup Guide

This guide explains how to set up iOS widgets for the Push/Pull fitness app.

## Current Status

⚠️ **Widget native module is not currently implemented.** The app is configured to support widgets (App Groups are enabled), but the native Swift code for `WidgetSyncModule` needs to be created.

## What's Already Done

✅ App Groups entitlement configured (`group.com.pushpull.app`)
✅ Widget sync service created ([widgetSync.ts](src/services/widgetSync.ts))
✅ Auto-sync hook implemented ([useWidgetSync.ts](src/hooks/useWidgetSync.ts))
✅ Weekly progress API endpoint ([sessions.ts:67-104](src/api/sessions.ts#L67-L104))

## What's Missing

The native Swift implementation needs to be created. You'll need:

### 1. WidgetSyncModule (Native Bridge)

Create `/ios/pushpull/WidgetSyncModule.swift`:

```swift
import Foundation
import React

@objc(WidgetSyncModule)
class WidgetSyncModule: NSObject {

  private let appGroupId = "group.com.pushpull.app"

  @objc
  func syncWidgetData(_ data: NSDictionary) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      print("❌ Failed to access App Group UserDefaults")
      return
    }

    // Sync each field if present
    if let weeklyGoal = data["weeklyGoal"] as? Int {
      userDefaults.set(weeklyGoal, forKey: "widget_weeklyGoal")
    }

    if let currentProgress = data["currentProgress"] as? Int {
      userDefaults.set(currentProgress, forKey: "widget_currentProgress")
    }

    if let userName = data["userName"] as? String {
      userDefaults.set(userName, forKey: "widget_userName")
    }

    if let userHandle = data["userHandle"] as? String {
      userDefaults.set(userHandle, forKey: "widget_userHandle")
    }

    if let authToken = data["authToken"] as? String {
      userDefaults.set(authToken, forKey: "widget_authToken")
    }

    if let apiBaseURL = data["apiBaseURL"] as? String {
      userDefaults.set(apiBaseURL, forKey: "widget_apiBaseURL")
    }

    if let currentStreak = data["currentStreak"] as? Int {
      userDefaults.set(currentStreak, forKey: "widget_currentStreak")
    }

    // Set last updated timestamp
    userDefaults.set(Date(), forKey: "widget_lastUpdated")
    userDefaults.synchronize()

    print("✅ Widget data synced successfully")
  }

  @objc
  func clearWidgetData() {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else { return }

    let keys = [
      "widget_weeklyGoal",
      "widget_currentProgress",
      "widget_userName",
      "widget_userHandle",
      "widget_authToken",
      "widget_apiBaseURL",
      "widget_currentStreak",
      "widget_lastUpdated"
    ]

    keys.forEach { userDefaults.removeObject(forKey: $0) }
    userDefaults.synchronize()

    print("✅ Widget data cleared")
  }

  @objc
  func refreshWidgets() {
    // Trigger WidgetKit reload
    #if canImport(WidgetKit)
    if #available(iOS 14.0, *) {
      WidgetKit.WidgetCenter.shared.reloadAllTimelines()
      print("📱 Widgets refreshed")
    }
    #endif
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

### 2. WidgetSyncModule Bridge Header

Create `/ios/pushpull/WidgetSyncModule.m`:

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetSyncModule, NSObject)

RCT_EXTERN_METHOD(syncWidgetData:(NSDictionary *)data)
RCT_EXTERN_METHOD(clearWidgetData)
RCT_EXTERN_METHOD(refreshWidgets)

@end
```

### 3. Widget Extension

Create a new Widget Extension in Xcode:

1. **File > New > Target > Widget Extension**
2. Name it "PushPullWidgets"
3. Add to the same App Group (`group.com.pushpull.app`)
4. Implement your widget UI in SwiftUI

Example widget entry:

```swift
import WidgetKit
import SwiftUI

struct WeeklyGoalWidget: Widget {
    let kind: String = "WeeklyGoalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WeeklyGoalWidgetView(entry: entry)
        }
        .configurationDisplayName("Weekly Goal")
        .description("Track your weekly workout goal")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct WeeklyGoalEntry: TimelineEntry {
    let date: Date
    let weeklyGoal: Int
    let currentProgress: Int
    let userName: String?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WeeklyGoalEntry {
        WeeklyGoalEntry(date: Date(), weeklyGoal: 4, currentProgress: 2, userName: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (WeeklyGoalEntry) -> ()) {
        // Read from App Group UserDefaults
        let userDefaults = UserDefaults(suiteName: "group.com.pushpull.app")
        let weeklyGoal = userDefaults?.integer(forKey: "widget_weeklyGoal") ?? 4
        let currentProgress = userDefaults?.integer(forKey: "widget_currentProgress") ?? 0
        let userName = userDefaults?.string(forKey: "widget_userName")

        let entry = WeeklyGoalEntry(
            date: Date(),
            weeklyGoal: weeklyGoal,
            currentProgress: currentProgress,
            userName: userName
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeeklyGoalEntry>) -> ()) {
        getSnapshot(in: context) { entry in
            // Refresh every hour
            let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

struct WeeklyGoalWidgetView: View {
    let entry: WeeklyGoalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Weekly Goal")
                .font(.caption)
                .foregroundColor(.secondary)

            Text("\(entry.currentProgress)/\(entry.weeklyGoal)")
                .font(.largeTitle)
                .fontWeight(.bold)

            ProgressView(value: Double(entry.currentProgress), total: Double(entry.weeklyGoal))
                .tint(.green)
        }
        .padding()
    }
}
```

## Testing the Setup

Once implemented:

1. **Build and run the app** to register the native module
2. **Log in** - widget data will auto-sync via `useWidgetSync` hook
3. **Add widget to home screen**:
   - Long press home screen > tap "+" > search "PushPull"
4. **Complete a workout** - widget should update automatically

## Debugging

Check if data is syncing:

```typescript
// In your app code (dev only)
import { syncWidgetData } from './services/widgetSync';

// Manually trigger sync
await syncWidgetData({
  weeklyGoal: 4,
  currentProgress: 2,
  userName: "John Doe"
});
```

Check native logs:
- Xcode Console: Look for "✅ Widget data synced successfully"
- Widget Timeline Provider: Add print statements to see when widgets refresh

## Current Workaround

The app will run fine without widgets - the `widgetSync` service gracefully handles the missing native module by showing a one-time warning and then silently returning. No functionality is broken.

To disable widget sync entirely, remove the `useWidgetSync()` call from your root component.
