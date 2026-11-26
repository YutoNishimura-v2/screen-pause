import Darwin
import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import OSLog
import WidgetKit

struct BlockSettings: Codable {
    let schedule: WeeklySchedule
    let selection: FamilyActivitySelection
    var additionalSchedules: [WeeklySchedule]?
    var strictEnabled: Bool?

    var schedules: [WeeklySchedule] { [schedule] + (additionalSchedules ?? []) }

    mutating func setSchedules(_ schedules: [WeeklySchedule]) {
        self = .init(schedule: schedules[0], selection: selection,
                     additionalSchedules: Array(schedules.dropFirst()), strictEnabled: strictEnabled)
    }
}

struct SharedState: Codable {
    var settings: BlockSettings?
    var progress = Progress()
    var session: Session?
    var pending: Request?
    var permit: Request?
    var unlockFailed = false
    var proAccess: ProAccess?
    var focusEnd: Date?
    var scheduleBank: Int?
    var baselineStart: Date?
    var customPause: PausePreferences?

    struct Session: Codable {
        let day: Date
        var kept = true
    }

    struct Request: Codable, Equatable {
        let app: ApplicationToken
        let date: Date
        var waitSeconds: Int? = nil

        var wait: TimeInterval { waitSeconds.map(Double.init) ?? PauseWindow.wait }
    }

    func plan(at now: Date) -> Plan {
        guard let proAccess else { return .free }
        return proAccess.plan(at: now)
    }

    /// The saved preferences as the user set them; free users always get the fixed standard wait.
    func configuredPause(at now: Date) -> PausePreferences {
        PaywallReason.customPause.isAvailable(on: plan(at: now)) ? customPause ?? .standard : .standard
    }

    /// The wait that applies to the next unlock, escalated by today's unlock count when enabled.
    func pause(at now: Date, calendar: Calendar = .current) -> PausePreferences {
        let base = configuredPause(at: now)
        guard base.isEscalating else { return base }
        let attempt = progress.unlockCount(at: now, calendar: calendar) + 1
        let seconds = PauseWindow.waitSeconds(unlockCount: attempt, base: base.seconds)
        return PausePreferences(seconds: seconds, message: base.message, escalating: true)
    }

    func widgetStateChanged(from old: SharedState) -> Bool {
        progress != old.progress || settings?.schedules != old.settings?.schedules ||
            focusEnd != old.focusEnd || proAccess != old.proAccess
    }

    func isBlocking(at now: Date, calendar: Calendar = .current) -> Bool {
        guard let settings else { return false }
        let multipleSchedules = PaywallReason.secondSchedule.isAvailable(on: plan(at: now))
        return BlockRules.isActive(schedules: multipleSchedules ? settings.schedules : [settings.schedule],
                                   focusEnd: focusEnd, at: now, calendar: calendar)
    }

    func isStrict(at now: Date, calendar: Calendar = .current) -> Bool {
        PaywallReason.strictMode.isAvailable(on: plan(at: now)) &&
            BlockRules.isStrict(enabled: settings?.strictEnabled == true,
                                active: isBlocking(at: now, calendar: calendar))
    }

    /// Returns the pending unlock request only if it matches the active block, current wait, and access window.
    func activePending(at now: Date, calendar: Calendar = .current) -> Request? {
        guard let pending,
              permit == nil,
              isBlocking(at: now, calendar: calendar),
              !isStrict(at: now, calendar: calendar),
              pending.wait == Double(pause(at: now, calendar: calendar).seconds),
              PauseWindow.isPendingActive(requestedAt: pending.date, now: now, wait: pending.wait) else {
            return nil
        }
        return pending
    }

    mutating func reconcile(at now: Date, calendar: Calendar) {
        if focusEnd.map({ now >= $0 }) == true {
            focusEnd = nil
        }
        let day = settings?.schedule.activeDay(at: now, calendar: calendar)
        if session?.day != day {
            if let prior = session, let schedule = settings?.schedule {
                progress.finish(day: prior.day, kept: prior.kept, schedule: schedule, calendar: calendar)
            }
            session = day.map { Session(day: $0) }
            pending = nil
            permit = nil
            unlockFailed = false
        }
        if !isBlocking(at: now, calendar: calendar) || isStrict(at: now, calendar: calendar) {
            pending = nil
            permit = nil
            unlockFailed = false
        }
        if let permit, !PauseWindow.isOpen(unlockedAt: permit.date, now: now) {
            self.permit = nil
        }
        if pending != nil, activePending(at: now, calendar: calendar) == nil {
            pending = nil
        }
    }
}

enum ScreenTime {
    static let group = "group.jp.screenpause.app"
    static let weekly = DeviceActivityName("weekly")
    static let relock = DeviceActivityName("relock")
    static let focus = DeviceActivityName("focus")
    private static let planExpiry = DeviceActivityName("planExpiry")
    // Two banks allow replacing schedules while staying below iOS's 20-monitor limit.
    static let maximumSchedules = 8
    private static let stateEntry = "screenTimeState"
    private static let store = ManagedSettingsStore(named: .init("screenPause"))

    enum Failure: Error {
        case storageUnavailable
        case invalidSettings
        case proRequired
        case strictInProgress
    }

    // The app and extensions can be invoked concurrently. Serialize the
    // defaults read-modify-write and shield updates across their processes.
    static func transaction<T>(
        applyShields: Bool = false, afterSave: (() -> Void)? = nil,
        _ change: (inout SharedState) throws -> T
    ) throws -> T {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group),
              let defaults = UserDefaults(suiteName: group) else { throw Failure.storageUnavailable }
        let path = container.appendingPathComponent("state.lock").path
        let descriptor = open(path, O_CREAT | O_RDWR, mode_t(S_IRUSR | S_IWUSR))
        guard descriptor >= 0 else { throw Failure.storageUnavailable }
        defer { close(descriptor) }
        guard flock(descriptor, LOCK_EX) == 0 else { throw Failure.storageUnavailable }
        defer { flock(descriptor, LOCK_UN) }

        guard defaults.synchronize() else { throw Failure.storageUnavailable }
        let existing = defaults.data(forKey: stateEntry)
        var state = try existing.map { try PropertyListDecoder().decode(SharedState.self, from: $0) } ?? SharedState()
        let previous = state
        let result = try change(&state)
        let updated = try PropertyListEncoder().encode(state)
        if updated != existing {
            defaults.set(updated, forKey: stateEntry)
            guard defaults.synchronize() else { throw Failure.storageUnavailable }
        }
        if applyShields { apply(state) }
        afterSave?()
        if state.widgetStateChanged(from: previous) { WidgetCenter.shared.reloadAllTimelines() }
        return result
    }

    static func readWidgetState() throws -> SharedState {
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) != nil,
              let defaults = UserDefaults(suiteName: group), defaults.synchronize() else {
            throw Failure.storageUnavailable
        }
        guard let data = defaults.data(forKey: stateEntry) else { return SharedState() }
        return try PropertyListDecoder().decode(SharedState.self, from: data)
    }

    static func refresh() throws -> SharedState {
        try transaction(applyShields: true) { state in
            let now = Date.now
            let calendar = Calendar.current
            state.reconcile(at: now, calendar: calendar)
            if state.settings != nil, state.baselineStart == nil {
                state.baselineStart = UsagePeriods.nextDay(after: now, calendar: calendar)
            }
            return state
        }
    }

    static func setCustomPause(_ preferences: PausePreferences) throws -> SharedState {
        try transaction(applyShields: true) { state in
            guard PaywallReason.customPause.isAvailable(on: state.plan(at: .now)) else {
                throw Failure.proRequired
            }
            guard state.settings != nil, preferences.isValid else { throw Failure.invalidSettings }
            if state.customPause != preferences {
                state.pending = nil
                state.unlockFailed = false
            }
            state.customPause = preferences
            return state
        }
    }

    @MainActor static func updateAccess(_ access: ProAccess?) throws -> SharedState {
        let center = DeviceActivityCenter()
        var retireCallback = false
        return try transaction(applyShields: true, afterSave: {
            if retireCallback { center.stopMonitoring([planExpiry]) }
        }) { state in
            if AuthorizationCenter.shared.authorizationStatus == .approved {
                let monitoringExpiry = center.activities.contains(planExpiry)
                if let end = access?.projectedEnd, end > .now {
                    if !monitoringExpiry || state.proAccess?.projectedEnd != end {
                        do {
                            let callback = Date(timeIntervalSince1970: ceil(end.timeIntervalSince1970))
                            try registerCallback(planExpiry, at: callback)
                        } catch {
                            retireCallback = monitoringExpiry
                            Logger(subsystem: "jp.screenpause.app", category: "monitor")
                                .error("Could not schedule subscription expiry: \(String(describing: error), privacy: .public)")
                        }
                    }
                } else {
                    retireCallback = monitoringExpiry
                }
            }
            state.proAccess = access
            state.reconcile(at: .now, calendar: .current)
            return state
        }
    }

    static func setStrict(_ enabled: Bool) throws -> SharedState {
        try transaction(applyShields: true) { state in
            let now = Date.now
            guard state.settings != nil else { throw Failure.invalidSettings }
            guard !enabled || PaywallReason.strictMode.isAvailable(on: state.plan(at: now)) else {
                throw Failure.proRequired
            }
            guard enabled || !state.isStrict(at: now) else { throw Failure.strictInProgress }
            state.settings?.strictEnabled = enabled
            state.reconcile(at: now, calendar: .current)
            return state
        }
    }

    static func startFocus(minutes: Int) throws -> SharedState {
        try transaction(applyShields: true) { state in
            let now = Date.now
            state.reconcile(at: now, calendar: .current)
            guard state.settings != nil, state.focusEnd == nil, (15...120).contains(minutes) else {
                throw Failure.invalidSettings
            }
            let end = Date(timeIntervalSince1970: ceil(now.timeIntervalSince1970)) + Double(minutes * 60)
            try registerCallback(focus, at: end)
            state.focusEnd = end
            state.pending = nil
            state.permit = nil
            state.reconcile(at: now, calendar: .current)
            return state
        }
    }

    private static func weeklyNames(_ bank: Int) -> [DeviceActivityName] {
        (0..<maximumSchedules).map { DeviceActivityName("weekly.\(bank).\($0)") }
    }

    static func handles(_ activity: DeviceActivityName) -> Bool {
        activity == weekly || activity == relock || activity == focus || activity == planExpiry ||
            weeklyNames(0).contains(activity) || weeklyNames(1).contains(activity)
    }

    static func install(_ newSettings: BlockSettings, replacingRevokedSelection: Bool = false) throws -> SharedState {
        let schedule = newSettings.schedule
        guard newSettings.schedules.count <= maximumSchedules, newSettings.schedules.allSatisfy(\.isValid),
              hasApps(newSettings.selection) else { throw Failure.invalidSettings }
        func clock(_ minute: Int) -> DateComponents {
            DateComponents(hour: minute / 60, minute: minute % 60)
        }
        let center = DeviceActivityCenter()
        var retired: [DeviceActivityName] = []
        return try transaction(applyShields: true, afterSave: {
            if !retired.isEmpty { center.stopMonitoring(retired) }
        }) { state in
            let now = Date.now
            let calendar = Calendar.current
            state.reconcile(at: now, calendar: calendar)
            guard !state.isStrict(at: now, calendar: calendar) ||
                    (replacingRevokedSelection && state.settings?.schedules == newSettings.schedules) else {
                throw Failure.strictInProgress
            }
            var settings = newSettings
            settings.strictEnabled = state.settings?.strictEnabled
            if !PaywallReason.secondSchedule.isAvailable(on: state.plan(at: now)),
               (settings.additionalSchedules ?? []) != (state.settings?.additionalSchedules ?? []) {
                throw Failure.proRequired
            }
            let bank = state.scheduleBank == 0 ? 1 : 0
            let names = weeklyNames(bank)
            center.stopMonitoring(names)
            do {
                // Callbacks reconcile the union using local start weekdays.
                for (name, window) in zip(names, settings.schedules) {
                    try center.startMonitoring(name, during: DeviceActivitySchedule(
                        intervalStart: clock(window.start), intervalEnd: clock(window.end), repeats: true
                    ))
                }
            } catch {
                center.stopMonitoring(names)
                throw error
            }
            retired = state.scheduleBank.map(weeklyNames) ?? [weekly]
            state.scheduleBank = bank
            if state.settings?.schedule != schedule {
                // An edit never awards a completed day for the old interval.
                let kept = state.session?.kept ?? true
                state.session = schedule.activeDay(at: now, calendar: calendar)
                    .map { SharedState.Session(day: $0, kept: kept) }
            }
            if state.baselineStart == nil ||
                state.settings?.selection.applicationTokens != settings.selection.applicationTokens ||
                state.settings?.selection.categoryTokens != settings.selection.categoryTokens {
                state.baselineStart = UsagePeriods.nextDay(after: now, calendar: calendar)
            }
            state.settings = settings
            state.pending = nil
            state.permit = nil
            state.unlockFailed = false
            state.reconcile(at: now, calendar: calendar)
            return state
        }
    }

    static func hasApps(_ selection: FamilyActivitySelection) -> Bool {
        !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty
    }

    private static func apply(_ state: SharedState) {
        let now = Date.now
        guard let settings = state.settings, state.isBlocking(at: now) else {
            store.clearAllSettings()
            return
        }
        let allowed = state.permit.flatMap {
            !state.isStrict(at: now) && PauseWindow.isOpen(unlockedAt: $0.date, now: now) ? $0.app : nil
        }
        let exceptions = Set([allowed].compactMap { $0 })
        let apps = settings.selection.applicationTokens.subtracting(exceptions)
        let categories = settings.selection.categoryTokens
        store.shield.applications = apps.isEmpty ? nil : apps
        store.shield.applicationCategories = categories.isEmpty ? nil : .specific(categories, except: exceptions)
    }

    static func registerRelock(at expires: Date) throws {
        try registerCallback(relock, at: expires)
    }

    private static func registerCallback(_ name: DeviceActivityName, at expires: Date) throws {
        // Refresh at the start of a one-shot interval so an idle phone can
        // receive the callback on its next use.
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0)!
        let fields: Set<Calendar.Component> = [.calendar, .timeZone, .year, .month, .day, .hour, .minute, .second]
        try DeviceActivityCenter().startMonitoring(name, during: DeviceActivitySchedule(
            intervalStart: utc.dateComponents(fields, from: expires),
            intervalEnd: utc.dateComponents(fields, from: expires.addingTimeInterval(24 * 60 * 60)),
            repeats: false
        ))
    }
}
