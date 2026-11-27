import FamilyControls
import SwiftUI
import UIKit

@main
@MainActor
struct ScreenPauseApp: App {
    var body: some Scene {
        WindowGroup {
            entry
                .tint(.indigo)
                .environment(\.locale, Locale(identifier: "ja_JP"))
        }
    }

    @ViewBuilder private var entry: some View {
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--screenshot-demo") {
            SetupView(demo: true)
                .preferredColorScheme(screenshotColorScheme)
                .dynamicTypeSize(ProcessInfo.processInfo.arguments.contains("--screenshot-ax5")
                    ? .accessibility5 : .large)
        } else if ProcessInfo.processInfo.arguments.contains("--storekit-test") {
            StoreKitTestView()
        } else {
            SetupView()
        }
        #else
        SetupView()
        #endif
    }

    #if DEBUG && targetEnvironment(simulator)
    private var screenshotColorScheme: ColorScheme {
        let arguments = ProcessInfo.processInfo.arguments
        if let argument = arguments.firstIndex(of: "--screenshot-appearance"),
           arguments.dropFirst(argument + 1).first == "dark" {
            return .dark
        }
        return .light
    }
    #endif
}

#if DEBUG && targetEnvironment(simulator)
@MainActor
private struct StoreKitTestView: View {
    @State private var store = ProStore()
    @State private var paywall: PaywallReason?

    var body: some View {
        let plan = (try? ScreenTime.transaction({ $0.plan(at: .now) })) ?? .free
        Form {
            Text("購入テスト")
            Text(store.accessError ?? (store.revision == 0
                ? "購入状況を確認中" : plan == .pro ? "Pro 利用中" : "無料プラン"))
            Button("2件目の予定を追加") {
                if !PaywallReason.secondSchedule.isAvailable(on: plan) {
                    paywall = .secondSchedule
                }
            }
            .disabled(store.revision == 0 || plan == .pro)
        }
        .sheet(item: $paywall) { Paywall(reason: $0, store: store) }
        .task { await store.listen() }
        .task { await store.refresh() }
    }
}
#endif

@MainActor
private struct SetupView: View {
    var demo = false
    private enum Step {
        case permission, schedule, home
    }

    private enum PermissionIssue: String {
        case denied = "スクリーンタイムへのアクセスが許可されていません。"
        case revoked = "スクリーンタイムへの許可が取り消されました。"
        case restricted = "端末の制限で許可できないため、保護者に設定の確認を頼んでください。"
        case unavailable = "スクリーンタイムに接続できませんでした。"
    }

    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var authorization = AuthorizationCenter.shared
    @AppStorage("needsAppReselection") private var needsAppReselection = false
    @State private var step = Step.permission
    @State private var permissionIssue: PermissionIssue?
    @State private var selection = FamilyActivitySelection()
    @State private var pickerSelection = FamilyActivitySelection()
    @State private var pickerSaveError: String?
    @State private var weekdays = Set(1...7)
    @State private var start = 0
    @State private var end = 0
    @State private var picker = false
    @State private var scheduleIndex = 0
    @State private var focusMinutes = 25
    @State private var paywall: PaywallReason?
    @State private var store = ProStore()
    @State private var confirmStrict = false
    @State private var confirmRemoveSchedule = false
    @State private var showSettings = false
    @State private var askingPermission = false
    @State private var snapshot = SharedState()
    @State private var errorMessage: String?
    @State private var now = Date.now
    @ScaledMetric(relativeTo: .largeTitle) private var countSize: CGFloat = 56

    private let dayNames = ["日", "月", "火", "水", "木", "金", "土"]
    private let utc = TimeZone(secondsFromGMT: 0)!

    var body: some View {
        NavigationStack {
            Form {
                switch step {
                case .permission: permissionForm
                case .schedule: scheduleForm
                case .home: homeForm
                }
                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.secondary)
                }
                if step == .home, let accessError = store.accessError {
                    Text(accessError).foregroundStyle(.secondary)
                    Button("購入状況を再確認") { Task { await store.refresh() } }
                }
            }
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Label("設定", systemImage: "gearshape")
                    }
                }
            }
            .navigationDestination(isPresented: $showSettings) {
                settingsView
            }
        }
        .id(permissionIssue != nil)
        .sheet(isPresented: $picker) { appPicker }
        .sheet(item: $paywall) { reason in
            Paywall(reason: reason, store: store, demo: demo)
        }
        .confirmationDialog("厳格モードをオンにしますか？", isPresented: $confirmStrict, titleVisibility: .visible) {
            Button("オンにする") { setStrict(true) }
            Button("キャンセル", role: .cancel) {}
        } message: {
            Text("いまの制限が終わるまで、一時解除や制限の変更ができなくなります。")
        }
        .confirmationDialog("この予定を削除しますか？", isPresented: $confirmRemoveSchedule, titleVisibility: .visible) {
            Button("削除する", role: .destructive, action: removeSchedule)
            Button("キャンセル", role: .cancel) {}
        }
        .task { if !demo { await store.listen() } }
        .onChange(of: store.revision) {
            if step == .home { restore() }
        }
        .onChange(of: authorization.authorizationStatus) { previous, current in
            guard !demo, !askingPermission else { return }
            if previous == .approved, current != .approved {
                showPermissionIssue(.revoked)
            } else {
                restore()
            }
        }
        .task(id: scenePhase) {
            guard !demo, scenePhase == .active else { return }
            await restoreOnActivation()
            await store.refresh()
            guard !Task.isCancelled else { return }
            restore()
            while !Task.isCancelled {
                let nextMinute = 60 - Date.now.timeIntervalSince1970.truncatingRemainder(dividingBy: 60)
                do {
                    try await Task.sleep(for: .seconds(nextMinute))
                } catch {
                    return
                }
                if step == .home { restore() }
            }
        }
    }

    private var title: String {
        switch step {
        case .permission: "ひと呼吸"
        case .schedule: "制限の予定"
        case .home: "ひと呼吸"
        }
    }

    private var permissionForm: some View {
        Section {
            setupHeading("開く前に、ひと呼吸。", detail: "スクリーンタイムと違い、開く前にひと呼吸おき、開かずに戻れた回数を記録します。")
            if let permissionIssue {
                Text(permissionIssue.rawValue)
                if permissionIssue == .denied || permissionIssue == .revoked {
                    Button("設定を開く") {
                        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                        openURL(url) { accepted in
                            if !accepted { errorMessage = "設定アプリで「ひと呼吸」の許可を確認してください。" }
                        }
                    }
                }
            }
            Button(setupActionTitle) {
                Task { await beginSetup() }
            }
            .accessibilityIdentifier("setup-permission")
            .disabled(askingPermission)
        } footer: {
            if permissionIssue == nil {
                Text("選んだアプリの制限と利用時間の表示に許可を使います。記録は端末内に保存します。")
            }
        }
    }

    private var setupActionTitle: String {
        if permissionIssue != nil { return "許可を再試行" }
        if demo || authorization.authorizationStatus != .approved { return "許可してアプリを選ぶ" }
        return "アプリやカテゴリを選ぶ"
    }

    private func openPicker() {
        if step == .home, let saved = snapshot.settings?.selection {
            selection = saved
        }
        pickerSaveError = nil
        pickerSelection = selection
        picker = true
    }

    private var appPicker: some View {
        NavigationStack {
            Group {
                if demo {
                    Form { Text("選んだアプリの制限を試せます。") }
                } else {
                    FamilyActivityPicker(selection: $pickerSelection)
                }
            }
            .navigationTitle("制限するアプリ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { picker = false }
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    if let pickerSaveError {
                        Text(pickerSaveError).font(.footnote)
                    } else if step == .permission {
                        Text(needsAppReselection ? "選んだ対象に元の予定を適用します。"
                             : "今すぐ始め、毎日この時間帯を制限します。")
                            .font(.footnote)
                    }
                    Button(pickerActionTitle, action: confirmApps)
                        .frame(minHeight: 44)
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("setup-start")
                        .disabled(!demo && !ScreenTime.hasApps(pickerSelection))
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(.background)
            }
        }
    }

    private var pickerActionTitle: String {
        if step == .schedule || step == .home { return "選択を反映" }
        return needsAppReselection ? "元の予定を再開" : "今から1時間の制限を始める"
    }

    private func confirmApps() {
        selection = pickerSelection
        if step == .permission || step == .home {
            pickerSaveError = nil
            save()
            guard pickerSaveError == nil, step == .home else { return }
        }
        picker = false
    }

    private func setupHeading(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.title2.bold()).accessibilityAddTraits(.isHeader)
            Text(detail).foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var scheduleForm: some View {
        Group {
            Section {
                DatePicker("開始", selection: clockBinding($start), displayedComponents: .hourAndMinute)
                    .environment(\.timeZone, utc)
                DatePicker("終了", selection: clockBinding($end), displayedComponents: .hourAndMinute)
                    .environment(\.timeZone, utc)
                DisclosureGroup(weekdaySummary) {
                    ForEach(1...7, id: \.self) { day in
                        Toggle(dayNames[day - 1] + "曜日", isOn: Binding(
                            get: { weekdays.contains(day) },
                            set: { enabled in
                                if enabled { weekdays.insert(day) } else { weekdays.remove(day) }
                            }
                        ))
                    }
                }
            } footer: {
                if weekdays.isEmpty {
                    Text("制限する曜日を1つ以上選んでください。")
                } else if !draft.isValid {
                    Text("開始から終了まで15分以上にしてください。")
                } else if start > end {
                    Text("翌日の終了時刻まで制限します。曜日は開始日です。")
                }
            }
            Section {
                Button("すべての予定に使うアプリやカテゴリを変更", action: openPicker)
                Button("変更を保存", action: save)
                    .disabled(!draft.isValid || !ScreenTime.hasApps(selection))
                Button("キャンセル") {
                    step = .home
                    refresh()
                }
                if scheduleIndex > 0, scheduleIndex < (snapshot.settings?.schedules.count ?? 0) {
                    Button("この予定を削除", role: .destructive) { confirmRemoveSchedule = true }
                }
            }
        }
    }

    private var homeForm: some View {
        let calendar = Calendar.current
        let plan = snapshot.plan(at: now)
        let strict = snapshot.isStrict(at: now)
        let count = snapshot.progress.count(at: now, calendar: calendar)
        let blocking = snapshot.isBlocking(at: now)
        let countDetail = blocking
            ? "対象アプリを開き「\(ShieldAppearance.primary)」で1回。"
            : "制限中に「\(ShieldAppearance.primary)」で1回。"

        return Group {
            Section {
                // Shield extensions cannot run timers, so the app renders the live countdown
                // for a pending unlock requested from the shield.
                if let pending = snapshot.activePending(at: now, calendar: calendar) {
                    VStack(alignment: .leading, spacing: 4) {
                        if snapshot.configuredPause(at: now).isEscalating {
                            Text(ShieldAppearance.attemptWaitLabel(
                                attempt: snapshot.progress.unlockCount(at: now, calendar: calendar) + 1,
                                seconds: Int(pending.wait)
                            ))
                            .font(.subheadline.weight(.medium))
                        }
                        TimelineView(.periodic(from: pending.date, by: 1)) { context in
                            if snapshot.activePending(at: context.date, calendar: calendar) == pending {
                                Text(ShieldAppearance.waitStatus(remainingSeconds: PauseWindow.remainingSeconds(
                                    requestedAt: pending.date, now: context.date, wait: pending.wait
                                )))
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                            } else {
                                Text("待機時間が終了しました。対象アプリを開いてやり直せます。")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .accessibilityIdentifier("home-pending-wait")
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text("今日、開かずに戻れた回数").font(.headline)
                        .accessibilityAddTraits(.isHeader)
                    Text("\(count)回")
                        .font(.system(size: countSize, weight: .semibold))
                        .monospacedDigit()
                    if count == 0 {
                        Text(countDetail).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 12)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("今日、開かずに戻れた回数、\(count)回")
                .accessibilityHint(count == 0 ? countDetail : "")
                .accessibilityIdentifier("home-count")
                if let settings = snapshot.settings {
                    let multipleSchedules = PaywallReason.secondSchedule.isAvailable(on: plan)
                    let schedules = multipleSchedules ? settings.schedules : [settings.schedule]
                    if blocking {
                        if let until = snapshot.blockingUntil(at: now, calendar: calendar) {
                            let remaining = max(1, Int(ceil(until.timeIntervalSince(now) / 60)))
                            LabeledContent("制限中", value: "\(until.formatted(date: .omitted, time: .shortened)) まで（あと\(remaining)分）")
                        } else {
                            Text("制限中")
                        }
                    } else if let next = schedules.compactMap({
                        $0.nextStart(after: now, calendar: calendar)
                    }).min() {
                        LabeledContent("次の制限開始", value: next.formatted(
                            .dateTime.month().day().weekday().hour().minute().locale(Locale(identifier: "ja_JP"))
                        ))
                    } else {
                        Text("次の制限を待っています")
                    }
                }
                if snapshot.needsStrictMigrationNotice(at: now) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("厳格モードは Pro 限定になり、現在は一時解除できます。")
                            .font(.footnote)
                        HStack {
                            Button("Pro を確認") { paywall = .strictMode }
                            Spacer()
                            Button("確認した") { setStrict(false) }
                                .foregroundStyle(.secondary)
                        }
                        .font(.footnote)
                        .buttonStyle(.borderless)
                    }
                    .accessibilityIdentifier("home-strict-migration-notice")
                }
            }
            Section {
                Button("制限するアプリを選ぶ", action: openPicker)
                    .disabled(strict || demo)
                    .accessibilityIdentifier("home-choose-apps")
                if PaywallReason.strictMode.isAvailable(on: plan) {
                    Toggle("厳格モード", isOn: Binding(
                        get: { snapshot.settings?.strictEnabled == true },
                        set: { enabled in
                            if enabled && snapshot.isBlocking(at: .now) { confirmStrict = true }
                            else { setStrict(enabled) }
                        }
                    ))
                    .disabled(strict || demo)
                } else {
                    Button { paywall = .strictMode } label: {
                        Label("厳格モード", systemImage: "lock.fill")
                    }
                }
                if let end = snapshot.focusEnd, now < end {
                    Text("集中時間中 · \(end.formatted(date: .omitted, time: .shortened)) まで")
                } else {
                    DisclosureGroup("今すぐ集中を始める") {
                        Picker("集中時間", selection: $focusMinutes) {
                            ForEach([15, 25, 45, 60, 90, 120], id: \.self) { minutes in
                                Text("\(minutes)分").tag(minutes)
                            }
                        }
                        Button("集中を開始する", action: startFocus)
                            .disabled(demo)
                    }
                }
                if demo {
                    NavigationLink("制限画面のプレビュー") {
                        ShieldDemoView(count: count) {
                            snapshot.progress.giveUp(at: now, calendar: .current)
                        }
                    }
                    .accessibilityIdentifier("home-shield")
                }
            }
            Section {
                if let settings = snapshot.settings {
                    NavigationLink("利用時間を見る") {
                        ReportsView(selection: settings.selection, baselineStart: snapshot.baselineStart, now: now,
                                    stopCount: count, demo: demo)
                    }
                    .accessibilityIdentifier("home-report")
                    if PaywallReason.progressHistory.isAvailable(on: plan) {
                        NavigationLink("回数の履歴と連続日数") {
                            ProgressHistoryView(state: $snapshot, now: $now)
                        }
                    } else {
                        Button("回数の履歴と連続日数") { paywall = .progressHistory }
                    }
                }
                if demo {
                    Button("購入画面のプレビュー") { paywall = .secondSchedule }
                        .accessibilityIdentifier("home-paywall")
                }
            }
        }
    }

    private var draft: WeeklySchedule { .init(weekdays: weekdays, start: start, end: end) }

    private var settingsView: some View {
        let plan = snapshot.plan(at: now)
        let strict = snapshot.isStrict(at: now)
        let multipleSchedules = PaywallReason.secondSchedule.isAvailable(on: plan)
        return Form {
            if step == .home, let settings = snapshot.settings {
                let schedules = multipleSchedules ? settings.schedules : [settings.schedule]
                Section {
                    ForEach(schedules.indices, id: \.self) { index in
                        Button(scheduleLabel(schedules[index])) { editSchedule(index) }
                            .disabled(strict || demo)
                    }
                    Button("予定を追加") {
                        if !multipleSchedules {
                            paywall = .secondSchedule
                        } else {
                            editSchedule(schedules.count)
                        }
                    }
                    .disabled(strict || schedules.count >= ScreenTime.maximumSchedules)
                } header: {
                    Text("制限の予定")
                } footer: {
                    if strict { Text("厳格モードは制限が終わると変更できます。") }
                }
                Section("待ち時間とメッセージ") {
                    if PaywallReason.customPause.isAvailable(on: plan) {
                        NavigationLink("待ち時間とメッセージ") {
                            CustomPauseView(preferences: snapshot.configuredPause(at: now)) { snapshot = $0 }
                        }
                        .disabled(demo)
                    } else {
                        Button { paywall = .customPause } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Label("待ち時間とメッセージ", systemImage: "lock.fill")
                                Text("無料では待ち時間は\(Int(PauseWindow.wait))秒固定です。開くたびに延ばす設定は Pro で使えます。")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityIdentifier("home-custom-pause-locked")
                    }
                }
            }
            Section {
                LegalLinks()
            }
        }
        .navigationTitle("設定")
    }

    private func scheduleLabel(_ schedule: WeeklySchedule) -> String {
        func time(_ minute: Int) -> String { String(format: "%02d:%02d", minute / 60, minute % 60) }
        let days = schedule.weekdays.count == 7
            ? "毎日" : schedule.weekdays.sorted().map { dayNames[$0 - 1] }.joined(separator: "・")
        let endDay = schedule.start > schedule.end ? "翌日" : ""
        return "\(days) \(time(schedule.start))〜\(endDay)\(time(schedule.end))"
    }

    private var weekdaySummary: String {
        if weekdays.count == 7 { return "曜日：毎日" }
        if weekdays.isEmpty { return "曜日を選ぶ" }
        let days = weekdays.sorted().map { dayNames[$0 - 1] }.joined(separator: "・")
        return "曜日：\(days)"
    }

    private func clockBinding(_ minute: Binding<Int>) -> Binding<Date> {
        Binding(
            get: { Date(timeIntervalSince1970: Double(minute.wrappedValue * 60)) },
            set: { minute.wrappedValue = (Int($0.timeIntervalSince1970 / 60) % 1440 + 1440) % 1440 }
        )
    }

    private func beginSetup() async {
        if demo {
            openPicker()
            return
        }
        let needsAuthorization = authorization.authorizationStatus != .approved
        if needsAuthorization { await authorize() }
        guard authorization.authorizationStatus == .approved else { return }
        restore()
        if step == .permission, errorMessage == nil { openPicker() }
        if needsAuthorization { await store.refresh() }
    }

    private func authorize() async {
        guard !askingPermission else { return }
        askingPermission = true
        defer { askingPermission = false }
        do {
            try await authorization.requestAuthorization(for: .individual)
            if authorization.authorizationStatus != .approved { showPermissionIssue(.denied) }
        } catch FamilyControlsError.restricted {
            showPermissionIssue(.restricted)
        } catch FamilyControlsError.authorizationCanceled {
            showPermissionIssue(.denied)
        } catch {
            showPermissionIssue(authorization.authorizationStatus == .denied ? .denied : .unavailable)
        }
    }

    private func restoreOnActivation() async {
        guard !askingPermission else { return }
        if authorization.authorizationStatus == .notDetermined, step == .permission,
           permissionIssue == nil, !needsAppReselection {
            do {
                // iOS can initially report .notDetermined for previously authorized users.
                if try ScreenTime.transaction({ $0.settings != nil }) {
                    await authorize()
                }
            } catch {
                errorMessage = "制限の設定を読み込めませんでした。もう一度お試しください。"
            }
        }
        restore()
    }

    private func restore() {
        guard !askingPermission else { return }
        switch authorization.authorizationStatus {
        case .notDetermined:
            if permissionIssue == nil, step != .permission || needsAppReselection {
                showPermissionIssue(.revoked)
            }
        case .denied:
            if permissionIssue == nil { showPermissionIssue(.denied) }
        case .approved:
            permissionIssue = nil
            if step == .permission || step == .home {
                if !needsAppReselection {
                    refresh()
                } else {
                    do {
                        snapshot = try ScreenTime.transaction { $0 }
                        needsAppReselection = snapshot.settings != nil
                        errorMessage = nil
                    } catch {
                        errorMessage = "制限の設定を読み込めませんでした。もう一度お試しください。"
                    }
                }
            }
        @unknown default:
            showPermissionIssue(.unavailable)
        }
    }

    private func showPermissionIssue(_ issue: PermissionIssue) {
        if snapshot.settings == nil, let saved = try? ScreenTime.transaction({ $0 }) {
            snapshot = saved
        }
        if snapshot.settings != nil { needsAppReselection = true }
        permissionIssue = needsAppReselection && issue == .denied ? .revoked : issue
        step = .permission
        picker = false
        paywall = nil
        confirmStrict = false
        selection = FamilyActivitySelection()
        pickerSelection = FamilyActivitySelection()
        errorMessage = nil
    }

    private func immediateSchedule(at date: Date) -> WeeklySchedule {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        let minute = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
        return .init(weekdays: Set(1...7), start: minute, end: (minute + 60) % 1440)
    }

    private func refresh() {
        do {
            snapshot = try ScreenTime.refresh()
            now = .now
            errorMessage = nil
            if snapshot.settings != nil { step = .home }
        } catch {
            errorMessage = "制限の設定を読み込めませんでした。もう一度お試しください。"
        }
    }

    private func editSchedule(_ index: Int) {
        guard let settings = snapshot.settings else { return }
        selection = settings.selection
        let window = settings.schedules.indices.contains(index) ? settings.schedules[index] : settings.schedule
        weekdays = window.weekdays
        start = window.start
        end = window.end
        scheduleIndex = index
        errorMessage = nil
        showSettings = false
        step = .schedule
    }

    private func save() {
        if !demo, authorization.authorizationStatus != .approved {
            showPermissionIssue(.denied)
            return
        }
        guard demo || ScreenTime.hasApps(selection) else { return }

        let firstStart = demo ? demoStart : .now
        let schedule = step == .schedule ? draft : snapshot.settings?.schedule ?? immediateSchedule(at: firstStart)
        var settings = BlockSettings(schedule: schedule, selection: selection)
        if let existing = snapshot.settings {
            var schedules = existing.schedules
            if step == .schedule {
                if scheduleIndex == schedules.count { schedules.append(schedule) }
                else { schedules[scheduleIndex] = schedule }
            }
            settings.setSchedules(schedules)
        }
        if demo {
            now = firstStart
            snapshot.settings = settings
            snapshot.baselineStart = now.addingTimeInterval(-14 * 86_400)
            snapshot.proAccess = ProAccess(expires: nil, willAutoRenew: nil)
            step = .home
            return
        }
        do {
            let recovering = needsAppReselection && snapshot.settings != nil
            snapshot = try ScreenTime.install(settings, replacingRevokedSelection: recovering)
            needsAppReselection = false
            now = .now
            errorMessage = nil
            step = .home
        } catch {
            if (step == .permission || step == .home), picker {
                pickerSaveError = needsAppReselection
                    ? "元の予定で制限を再開できませんでした。もう一度お試しください。"
                    : "制限を設定できませんでした。もう一度お試しください。"
            } else {
                errorMessage = "制限を設定できませんでした。もう一度お試しください。"
            }
        }
    }

    private var demoStart: Date {
        Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 25, hour: 20))!
    }

    private func removeSchedule() {
        guard var settings = snapshot.settings, scheduleIndex > 0,
              settings.schedules.indices.contains(scheduleIndex) else { return }
        var schedules = settings.schedules
        schedules.remove(at: scheduleIndex)
        settings.setSchedules(schedules)
        do {
            snapshot = try ScreenTime.install(settings)
            step = .home
            refresh()
        } catch {
            errorMessage = "予定を削除できませんでした。"
        }
    }

    private func setStrict(_ enabled: Bool) {
        do {
            snapshot = try ScreenTime.setStrict(enabled)
            now = .now
            errorMessage = nil
        } catch {
            errorMessage = "厳格モードを変更できませんでした。制限時間を確認してください。"
        }
    }

    private func startFocus() {
        do {
            snapshot = try ScreenTime.startFocus(minutes: focusMinutes)
            now = .now
            errorMessage = nil
        } catch {
            errorMessage = "集中時間を開始できませんでした。もう一度お試しください。"
        }
    }
}
