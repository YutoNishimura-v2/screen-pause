import DeviceActivity
import Foundation
import SwiftUI

extension DeviceActivityReport.Context {
    static let selectedUsage = Self("selectedUsage")
    static let currentUsage = Self("currentUsage")
}

enum UsagePeriods {
    static func nextDay(after date: Date, calendar: Calendar) -> Date {
        calendar.dateInterval(of: .day, for: date)!.end
    }

    static func monday(containing date: Date, calendar: Calendar) -> Date {
        var calendar = calendar
        calendar.firstWeekday = 2
        return calendar.dateInterval(of: .weekOfYear, for: date)!.start
    }

    static func comparisonStart(baseline: Date, week: Date, calendar: Calendar) -> Date? {
        let start = calendar.startOfDay(for: baseline)
        // Bound the request to five prior weeks plus this week.
        guard let oldest = calendar.date(byAdding: .day, value: -35, to: week), start >= oldest,
              let end = calendar.date(byAdding: .day, value: 7, to: start), end <= week else { return nil }
        return start
    }

    static func fillZeroDays(
        _ daily: inout [Date: TimeInterval], in interval: DateInterval, updatedAt: Date, calendar: Calendar
    ) {
        // Leading gaps can be expired history. Only fill after the first returned segment
        // and through the last day for which Screen Time has an update.
        guard let firstObserved = daily.keys.min() else { return }
        var day = calendar.startOfDay(for: interval.start)
        while day < interval.end {
            if day >= firstObserved, day <= updatedAt, daily[day] == nil { daily[day] = 0 }
            day = nextDay(after: day, calendar: calendar)
        }
    }

    static func savedTime(
        daily: [Date: TimeInterval], baseline: Date, week: Date, today: Date, calendar: Calendar
    ) -> TimeInterval? {
        let baselineDays = (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: baseline) }
        guard baselineDays.count == 7, let last = baselineDays.last, today > last,
              baselineDays.allSatisfy({ daily[$0] != nil }) else { return nil }

        // Compare completed days only and never compare the baseline against itself.
        let count = calendar.dateComponents([.day], from: week, to: today).day ?? 0
        guard (1...6).contains(count), week > last else { return nil }
        let currentDays = (0..<count).compactMap { calendar.date(byAdding: .day, value: $0, to: week) }
        let current = currentDays.compactMap { daily[$0] }
        guard current.count == count else { return nil }
        let baselineTotal = baselineDays.prefix(count).compactMap { daily[$0] }.reduce(0, +)
        return max(0, baselineTotal - current.reduce(0, +))
    }
}
