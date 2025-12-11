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
        QuickSetLoggerWidget()
        if #available(iOS 16.1, *) {
            WorkoutLiveActivity()
        }
    }
}
