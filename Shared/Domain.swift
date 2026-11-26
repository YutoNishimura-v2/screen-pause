import Foundation

enum Plan: Equatable {
    case free, pro
}

// Projection of verified StoreKit access for the app and Screen Time extensions.
struct ProAccess: Codable, Equatable {
    // Bridge a renewal while the app is suspended. A StoreKit refresh replaces
    // this projection immediately, including when access is revoked.
    private static let renewalMargin: TimeInterval = 7 * 24 * 60 * 60

    let expires: Date?
    let willAutoRenew: Bool?

    var projectedEnd: Date? {
        expires?.addingTimeInterval(willAutoRenew == true ? Self.renewalMargin : 0)
    }

    func plan(at now: Date) -> Plan {
        guard let projectedEnd else { return .pro }
        return now < projectedEnd ? .pro : .free
    }
}

enum PaywallReason: String, Identifiable {
    case secondSchedule, progressHistory, customPause
    case strictMode

    var id: Self { self }

    func isAvailable(on plan: Plan) -> Bool { plan == .pro }
}

struct WeeklySchedule: Codable, Equatable {
    // Calendar weekday numbers: Sunday = 1. Overnight hours belong to the start day.
    let weekdays: Set<Int>
    let start: Int
    let end: Int

    var isValid: Bool {
        guard !weekdays.isEmpty, weekdays.allSatisfy({ (1...7).contains($0) }),
              (0..<1440).contains(start), (0..<1440).contains(end) else { return false }
        // DeviceActivity rejects intervals shorter than 15 minutes.
        return (end - start + 1440) % 1440 >= 15
    }

    func activeDay(at now: Date, calendar: Calendar) -> Date? {
        guard isValid else { return nil }
        let clock = calendar.dateComponents([.hour, .minute], from: now)
        let minute = (clock.hour ?? 0) * 60 + (clock.minute ?? 0)
        let today = calendar.startOfDay(for: now)
        let day: Date
        if start < end {
            guard minute >= start, minute < end else { return nil }
            day = today
        } else if minute >= start {
            day = today
        } else {
            guard minute < end,
                  let yesterday = calendar.date(byAdding: .day, value: -1, to: today) else { return nil }
            day = yesterday
        }
        return weekdays.contains(calendar.component(.weekday, from: day)) ? day : nil
    }

    func nextStart(after now: Date, calendar: Calendar) -> Date? {
        guard isValid else { return nil }
        return weekdays.flatMap { weekday in
            let time = DateComponents(hour: start / 60, minute: start % 60, second: 0, weekday: weekday)
            return [Calendar.RepeatedTimePolicy.first, .last].compactMap { occurrence in
                calendar.nextDate(after: now, matching: time, matchingPolicy: .strict,
                                  repeatedTimePolicy: occurrence)
            }
        }.min()
    }

    func previousDay(before day: Date, calendar: Calendar) -> Date? {
        for offset in 1...7 {
            guard let previous = calendar.date(byAdding: .day, value: -offset, to: day) else { return nil }
            if weekdays.contains(calendar.component(.weekday, from: previous)) { return previous }
        }
        return nil
    }
}

enum BlockRules {
    static func isActive(schedules: [WeeklySchedule], focusEnd: Date?, at now: Date, calendar: Calendar) -> Bool {
        (focusEnd.map { now < $0 } ?? false) ||
            schedules.contains { $0.activeDay(at: now, calendar: calendar) != nil }
    }

    static func isStrict(enabled: Bool, active: Bool) -> Bool {
        enabled && active
    }
}

enum PendingAction: Equatable {
    case waiting(Int)
    case unlock
    case restart
}

enum PauseWindow {
    static let wait: TimeInterval = 10
    static let access: TimeInterval = 300
    static let escalationGrowth = 2
    static let escalationCap = 300

    /// Wait before the Nth unlock of the local day: base × growth^(N-1), capped.
    static func waitSeconds(
        unlockCount: Int,
        base: Int = Int(wait),
        growth: Int = escalationGrowth,
        cap: Int = escalationCap
    ) -> Int {
        let clampedBase = max(0, base)
        let clampedCap = max(0, cap)
        guard clampedBase > 0, clampedCap > 0 else { return 0 }
        let attempt = max(1, unlockCount)
        let factor = max(1, growth)
        var seconds = min(clampedBase, clampedCap)
        guard factor > 1 else { return seconds }
        for _ in 1..<attempt {
            if seconds >= clampedCap { return clampedCap }
            let (product, overflow) = seconds.multipliedReportingOverflow(by: factor)
            seconds = overflow ? clampedCap : min(product, clampedCap)
        }
        return seconds
    }

    static func remainingSeconds(requestedAt: Date, now: Date, wait: TimeInterval) -> Int {
        let remaining = requestedAt.addingTimeInterval(wait).timeIntervalSince(now)
        return max(0, Int(ceil(remaining)))
    }

    static func isPendingActive(requestedAt: Date, now: Date, wait: TimeInterval) -> Bool {
        let elapsed = now.timeIntervalSince(requestedAt)
        return elapsed >= 0 && elapsed < wait + access
    }

    static func pendingAction(
        requestedAt: Date?, now: Date, strict: Bool = false, wait: TimeInterval
    ) -> PendingAction {
        guard !strict, let requestedAt, isPendingActive(requestedAt: requestedAt, now: now, wait: wait) else {
            return .restart
        }
        if canUnlock(requestedAt: requestedAt, now: now, strict: false, wait: wait) {
            return .unlock
        }
        return .waiting(max(1, remainingSeconds(requestedAt: requestedAt, now: now, wait: wait)))
    }

    static func canUnlock(requestedAt: Date, now: Date, strict: Bool, wait: TimeInterval = PauseWindow.wait) -> Bool {
        let elapsed = now.timeIntervalSince(requestedAt)
        // A persisted request can be retried briefly if iOS suspends the extension.
        return !strict && elapsed >= wait && elapsed < wait + access
    }

    static func expires(unlockedAt: Date) -> Date {
        unlockedAt.addingTimeInterval(access)
    }

    static func isOpen(unlockedAt: Date, now: Date) -> Bool {
        now >= unlockedAt && now < expires(unlockedAt: unlockedAt)
    }
}

struct PausePreferences: Codable, Equatable {
    static let secondsRange = 0...60
    static let messageLimit = 80
    static let standard = Self(seconds: Int(PauseWindow.wait), message: "")

    let seconds: Int
    let message: String
    // Optional for preferences saved before the escalating wait was introduced.
    private var escalating: Bool?

    init(seconds: Int, message: String, escalating: Bool = false) {
        self.seconds = seconds
        self.message = message
        // nil keeps fixed-wait preferences equal to those saved by earlier versions.
        self.escalating = escalating ? true : nil
    }

    var isEscalating: Bool { escalating == true }

    var isValid: Bool {
        Self.secondsRange.contains(seconds) &&
            (!isEscalating || seconds > 0) &&
            message.count <= Self.messageLimit
    }
}

enum LocalDay {
    /// The local calendar day of `date`; it changes at local midnight in `calendar`'s time zone.
    static func key(at date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

enum CalendarDayStatus: Equatable {
    case kept
    case missed
    case noSchedule
}

struct MonthCalendarDay: Equatable, Identifiable {
    let date: Date
    let dayNumber: Int
    let status: CalendarDayStatus

    var id: Date { date }
}

struct MonthCalendarGrid: Equatable {
    let monthStart: Date
    let leadingEmptyDays: Int
    let days: [MonthCalendarDay]
}

struct Progress: Codable, Equatable {
    struct DayCount: Codable, Equatable {
        let date: Date
        var count: Int
    }

    private var countDate: Date?
    private var giveUps = 0
    private var lastKept: Date?
    private var streak = 0
    // Optional for records saved before daily history was introduced.
    private var dailyStops: [DayCount]?
    private var historyStart: Date?
    // Optional for records saved before the escalating wait and month calendar.
    private var unlockDayKey: String?
    private var unlocksToday: Int?
    private var dayResults: [String: Bool]?

    func count(at now: Date, calendar: Calendar) -> Int {
        guard let countDate, calendar.isDate(countDate, inSameDayAs: now) else { return 0 }
        return giveUps
    }

    /// Unlocks granted so far on the local day of `now`; resets at local midnight.
    func unlockCount(at now: Date, calendar: Calendar) -> Int {
        guard unlockDayKey == LocalDay.key(at: now, calendar: calendar) else { return 0 }
        return unlocksToday ?? 0
    }

    mutating func recordUnlock(at now: Date, calendar: Calendar) {
        unlocksToday = unlockCount(at: now, calendar: calendar) + 1
        unlockDayKey = LocalDay.key(at: now, calendar: calendar)
    }

    mutating func giveUp(at now: Date, calendar: Calendar) {
        giveUps = count(at: now, calendar: calendar) + 1
        countDate = now
        var records = dailyStops ?? []
        if let index = records.firstIndex(where: { calendar.isDate($0.date, inSameDayAs: now) }) {
            records[index].count += 1
        } else {
            records.append(.init(date: now, count: giveUps))
        }
        dailyStops = Array(records.sorted { $0.date < $1.date }.suffix(56))
        historyStart = min(historyStart ?? now, now)
    }

    func history(at now: Date, calendar: Calendar) -> [DayCount] {
        let today = calendar.startOfDay(for: now)
        let earliest = calendar.date(byAdding: .day, value: -55, to: today) ?? today
        return (dailyStops ?? []).reversed().filter {
            $0.date >= earliest && calendar.startOfDay(for: $0.date) <= today
        }
    }

    func recentStopCount(at now: Date, calendar: Calendar) -> Int {
        let today = calendar.startOfDay(for: now)
        guard let start = calendar.date(byAdding: .day, value: -6, to: today) else { return 0 }
        let records = history(at: now, calendar: calendar).filter { $0.date >= start }
        let recordedCount = records.reduce(0) { $0 + $1.count }
        // Older saved state may only have today's count.
        return records.contains { calendar.isDate($0.date, inSameDayAs: now) }
            ? recordedCount : recordedCount + count(at: now, calendar: calendar)
    }

    func weeklyComparison(at now: Date, calendar: Calendar) -> (current: Int, previous: Int)? {
        var calendar = calendar
        calendar.firstWeekday = 2
        let today = calendar.startOfDay(for: now)
        guard let week = calendar.dateInterval(of: .weekOfYear, for: today)?.start, today > week,
              let previousWeek = calendar.date(byAdding: .day, value: -7, to: week),
              let previousEnd = calendar.date(byAdding: .day, value: -7, to: today),
              let historyStart, calendar.startOfDay(for: historyStart) <= previousWeek else { return nil }
        let records = history(at: now, calendar: calendar)
        func total(from start: Date, to end: Date) -> Int {
            records.filter { $0.date >= start && $0.date < end }.reduce(0) { $0 + $1.count }
        }
        return (total(from: week, to: today), total(from: previousWeek, to: previousEnd))
    }

    mutating func finish(day: Date, kept: Bool, schedule: WeeklySchedule, calendar: Calendar) {
        if let lastKept, calendar.isDate(lastKept, inSameDayAs: day) { return }
        recordResult(day: day, kept: kept, calendar: calendar)
        guard kept else {
            lastKept = nil
            streak = 0
            return
        }
        streak = currentStreak(relativeTo: day, schedule: schedule, calendar: calendar) + 1
        lastKept = day
    }

    /// Keeps one result per local day for the month calendar; a missed result is final.
    private mutating func recordResult(day: Date, kept: Bool, calendar: Calendar) {
        let key = LocalDay.key(at: day, calendar: calendar)
        var results = dayResults ?? [:]
        if results[key] != false { results[key] = kept }
        // Keys sort chronologically, so this drops the oldest days beyond a year.
        for stale in results.keys.sorted().dropLast(Self.resultDays) {
            results.removeValue(forKey: stale)
        }
        dayResults = results
    }

    private static let resultDays = 366

    func monthCalendar(for month: Date, calendar: Calendar) -> MonthCalendarGrid {
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: month))
            ?? calendar.startOfDay(for: month)
        guard let range = calendar.range(of: .day, in: .month, for: monthStart) else {
            return MonthCalendarGrid(monthStart: monthStart, leadingEmptyDays: 0, days: [])
        }
        let firstWeekday = calendar.component(.weekday, from: monthStart)
        let leadingEmptyDays = (firstWeekday - calendar.firstWeekday + 7) % 7
        let results = dayResults ?? [:]

        let days: [MonthCalendarDay] = range.compactMap { dayNumber in
            guard let date = calendar.date(byAdding: .day, value: dayNumber - 1, to: monthStart) else { return nil }
            let status: CalendarDayStatus
            if let kept = results[LocalDay.key(at: date, calendar: calendar)] {
                status = kept ? .kept : .missed
            } else if let lastKept, calendar.isDate(lastKept, inSameDayAs: date) {
                status = .kept
            } else {
                status = .noSchedule
            }
            return MonthCalendarDay(date: date, dayNumber: dayNumber, status: status)
        }
        return MonthCalendarGrid(monthStart: monthStart, leadingEmptyDays: leadingEmptyDays, days: days)
    }

    func currentStreak(relativeTo day: Date, schedule: WeeklySchedule, calendar: Calendar) -> Int {
        guard let lastKept else { return 0 }
        if calendar.isDate(lastKept, inSameDayAs: day) { return streak }
        guard day > lastKept else { return 0 }
        // A scheduled day can still be kept today. A missed scheduled day breaks the streak.
        if let previous = schedule.previousDay(before: day, calendar: calendar),
           calendar.isDate(lastKept, inSameDayAs: previous) { return streak }
        return 0
    }
}
