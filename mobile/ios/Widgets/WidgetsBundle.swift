//
//  WidgetsBundle.swift
//  Widgets
//
//  Push/Pull Widgets Bundle
//

import WidgetKit
import SwiftUI

@main
struct WidgetsBundle: WidgetBundle {
    var body: some Widget {
        PushPullWidgets()
        // Temporarily disable the quick logging home screen widget; keep goals + Live Activity.
        if #available(iOS 16.1, *) {
            WorkoutLiveActivity()
        }
    }
}
