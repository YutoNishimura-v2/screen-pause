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

    /// Fallback comparison when iOS returns partial hourly history or no completed days in the current week yet.
    static func flexibleSavedTime(
        daily: [Date: TimeInterval],
        hourlyByDay: [Date: [Int: TimeInterval]],
        baseline: Date,
        week: Date,
        now: Date,
        calendar: Calendar
    ) -> TimeInterval? {
        let today = calendar.startOfDay(for: now)
        if let exact = savedTime(daily: daily, baseline: baseline, week: week, today: today, calendar: calendar) {
            return exact
        }
        let baselineDays = (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: baseline) }
        guard let lastBaseline = baselineDays.last, week > lastBaseline, today > lastBaseline else {
            return nil
        }
        let count = min(6, calendar.dateComponents([.day], from: week, to: today).day ?? 0)
        if count >= 1 {
            let matchedPairs: [(TimeInterval, TimeInterval)] = (0..<count).compactMap { offset in
                guard let base = daily[baselineDays[offset]],
                      let currentDay = calendar.date(byAdding: .day, value: offset, to: week),
                      let current = daily[currentDay] else { return nil }
                return (base, current)
            }
            if !matchedPairs.isEmpty {
                let baseTotal = matchedPairs.reduce(0) { $0 + $1.0 }
                let currentTotal = matchedPairs.reduce(0) { $0 + $1.1 }
                return max(0, baseTotal - currentTotal)
            }
        }
        let weekdayOffset = max(0, min(6, calendar.dateComponents([.day], from: week, to: today).day ?? 0))
        let baselineDay = baselineDays[weekdayOffset]
        guard daily[baselineDay] != nil, daily[today] != nil else { return nil }
        let hour = calendar.component(.hour, from: now)
        let baseHours = hourlyByDay[baselineDay] ?? [:]
        let todayHours = hourlyByDay[today] ?? [:]
        let basePartial = (0...hour).reduce(0.0) { $0 + (baseHours[$1] ?? 0) }
        let todayPartial = (0...hour).reduce(0.0) { $0 + (todayHours[$1] ?? 0) }
        return max(0, basePartial - todayPartial)
    }

    /// Compares today's cumulative usage through `currentHour` against the same hour window yesterday.
    static func sameHourDelta(
        daily: [Date: TimeInterval],
        hourlyByDay: [Date: [Int: TimeInterval]],
        now: Date,
        calendar: Calendar
    ) -> TimeInterval? {
        let today = calendar.startOfDay(for: now)
        guard let yesterday = calendar.date(byAdding: .day, value: -1, to: today),
              daily[yesterday] != nil, daily[today] != nil else { return nil }
        let hour = calendar.component(.hour, from: now)
        let previousHours = hourlyByDay[yesterday] ?? [:]
        let currentHours = hourlyByDay[today] ?? [:]
        let previous = (0...hour).reduce(0.0) { $0 + (previousHours[$1] ?? 0) }
        let current = (0...hour).reduce(0.0) { $0 + (currentHours[$1] ?? 0) }
        return current - previous
    }
}
