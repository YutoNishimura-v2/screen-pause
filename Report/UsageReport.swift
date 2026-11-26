import DeviceActivity
import SwiftUI

@main
struct UsageReportExtension: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        UsageScene(context: .selectedUsage) { UsageReportView(summary: $0) }
        UsageScene(context: .currentUsage) { UsageReportView(summary: $0) }
    }
}

struct UsageScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context
    let content: (UsageSummary) -> UsageReportView

    func makeConfiguration(representing results: DeviceActivityResults<DeviceActivityData>) async -> UsageSummary {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let week = UsagePeriods.monday(containing: today, calendar: calendar)
        var baseline: Date?
        var daily: [Date: TimeInterval] = [:]
        for await data in results {
            guard case let .daily(interval) = data.segmentInterval else { continue }
            // The report filter carries the baseline date without sending usage outside this extension.
            if context == .selectedUsage { baseline = calendar.startOfDay(for: interval.start) }
            var deviceDays: [Date: TimeInterval] = [:]
            for await segment in data.activitySegments {
                let day = calendar.startOfDay(for: segment.dateInterval.start)
                guard day >= interval.start, day < interval.end, day <= today else { continue }
                var duration: TimeInterval = 0
                for await category in segment.categories {
                    for await app in category.applications {
                        duration += app.totalActivityDuration
                    }
                }
                deviceDays[day, default: 0] += duration
            }
            UsagePeriods.fillZeroDays(&deviceDays, in: interval, updatedAt: data.lastUpdatedDate, calendar: calendar)
            for (day, duration) in deviceDays { daily[day, default: 0] += duration }
        }
        let days = (0..<7).compactMap { offset -> UsageSummary.Day? in
            guard let day = calendar.date(byAdding: .day, value: offset, to: week), day <= today else { return nil }
            return .init(date: day, duration: daily[day])
        }
        let durations = days.compactMap { $0.duration }
        return UsageSummary(
            days: days,
            week: durations.count == days.count ? durations.reduce(0, +) : nil,
            saved: baseline.flatMap {
                UsagePeriods.savedTime(daily: daily, baseline: $0, week: week, today: today, calendar: calendar)
            }
        )
    }
}
