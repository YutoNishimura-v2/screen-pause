import DeviceActivity
import FamilyControls
import SwiftUI

struct ReportsView: View {
    let selection: FamilyActivitySelection
    let baselineStart: Date?
    let now: Date
    let stopCount: Int
    var demo = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("今日、開かずに戻れた回数は\(stopCount)回です。")
                .accessibilityLabel("今日、開かずに戻れた回数、\(stopCount)回")
                .padding()
            if let baselineStart, now < baselineStart {
                Text("利用時間はスクリーンタイムに記録されると表示されます。")
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
                    .padding(.bottom)
            }
            if demo {
                UsageReportView(summary: sample)
            } else {
                liveReport
            }
        }
        .navigationTitle("利用時間")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var liveReport: some View {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        let week = UsagePeriods.monday(containing: today, calendar: calendar)
        let comparisonStart = baselineStart.flatMap {
            UsagePeriods.comparisonStart(baseline: $0, week: week, calendar: calendar)
        }
        let end = UsagePeriods.nextDay(after: now, calendar: calendar)
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today) ?? today
        let start = comparisonStart ?? min(week, yesterday)
        let context: DeviceActivityReport.Context = comparisonStart == nil ? .currentUsage : .selectedUsage
        DeviceActivityReport(context, filter: DeviceActivityFilter(
            segment: .hourly(during: DateInterval(start: start, end: end)),
            applications: selection.applicationTokens,
            categories: selection.categoryTokens
        ))
    }

    private var sample: UsageSummary {
        let calendar = Calendar.current
        let week = UsagePeriods.monday(containing: now, calendar: calendar)
        let minutes = [34.0, 24.0, 18.0]
        let days = minutes.enumerated().map { day, duration in
            UsageSummary.Day(date: calendar.date(byAdding: .day, value: day, to: week)!, duration: duration * 60)
        }
        return UsageSummary(days: days, week: minutes.reduce(0, +) * 60, saved: 48 * 60,
                            earlyDelta: nil, apps: [], hourly: [])
    }
}

struct ProgressHistoryView: View {
    @Binding var state: SharedState
    @Binding var now: Date
    @State private var displayedMonth: Date?

    var body: some View {
        let calendar = Calendar.current
        let progress = state.progress
        Form {
            if PaywallReason.progressHistory.isAvailable(on: state.plan(at: now)),
               let schedule = state.settings?.schedule {
                let day = schedule.activeDay(at: now, calendar: calendar) ?? now
                let streak = progress.currentStreak(relativeTo: day, schedule: schedule, calendar: calendar)
                Section("連続日数") {
                    Text("\(streak)日")
                    Text("最初の予定を一時解除せずに終えた日を数えます。")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("月ごとの記録") {
                    let grid = progress.monthCalendar(for: displayedMonth ?? now, calendar: calendar)
                    MonthCalendarView(grid: grid, calendar: calendar) { months in
                        displayedMonth = calendar.date(byAdding: .month, value: months, to: grid.monthStart)
                    }
                }
                if let comparison = progress.weeklyComparison(at: now, calendar: calendar) {
                    Section("開かずに戻れた回数の週比較") {
                        LabeledContent("今週", value: "\(comparison.current)回")
                        LabeledContent("先週", value: "\(comparison.previous)回")
                        Text("月曜から、昨日までと同じ曜日分を比べます。")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                } else {
                    Section("開かずに戻れた回数") {
                        LabeledContent("直近7日間", value: "\(progress.recentStopCount(at: now, calendar: calendar))回")
                    }
                }
                Section("日別の回数履歴（直近56日）") {
                    let records = progress.history(at: now, calendar: calendar)
                    if records.isEmpty { Text("回数の履歴はまだありません。") }
                    ForEach(records, id: \.date) { record in
                        LabeledContent(
                            record.date.formatted(.dateTime.month().day().locale(Locale(identifier: "ja_JP"))),
                            value: "\(record.count)回"
                        )
                    }
                }
            } else {
                Text("履歴の表示には Pro が必要です。")
            }
        }
        .navigationTitle("回数の履歴と連続日数")
    }
}

/// A month grid of the primary schedule's results, stored on the device in the shared state.
private struct MonthCalendarView: View {
    let grid: MonthCalendarGrid
    let calendar: Calendar
    let onMove: (Int) -> Void

    private static let japanese = Locale(identifier: "ja_JP")
    private static let dayNames = ["日", "月", "火", "水", "木", "金", "土"]

    private var weekdayHeaders: [String] {
        (0..<7).map { Self.dayNames[(calendar.firstWeekday - 1 + $0) % 7] }
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button { onMove(-1) } label: {
                    Image(systemName: "chevron.left").frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel("前の月")
                Spacer()
                Text(grid.monthStart.formatted(.dateTime.year().month().locale(Self.japanese)))
                    .font(.headline)
                Spacer()
                Button { onMove(1) } label: {
                    Image(systemName: "chevron.right").frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel("次の月")
            }
            .buttonStyle(.borderless)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                ForEach(weekdayHeaders.indices, id: \.self) { index in
                    Text(weekdayHeaders[index]).font(.caption).foregroundStyle(.secondary)
                }
                ForEach(0..<grid.leadingEmptyDays, id: \.self) { _ in
                    Color.clear.frame(height: 36)
                }
                ForEach(grid.days) { day in
                    dayCell(day)
                }
            }

            Text("✓は守れた日、枠は守れなかった日です。記録はこの端末だけに保存します。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
    }

    private func dayCell(_ day: MonthCalendarDay) -> some View {
        let date = day.date.formatted(.dateTime.month().day().locale(Self.japanese))
        let status: String
        switch day.status {
        case .kept: status = "守れた日"
        case .missed: status = "守れなかった日"
        case .noSchedule: status = "予定なし"
        }
        return VStack(spacing: 0) {
            Text("\(day.dayNumber)")
                .font(.caption.weight(day.status == .kept ? .semibold : .regular))
                .monospacedDigit()
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .bold))
                .opacity(day.status == .kept ? 1 : 0)
        }
        .foregroundStyle(day.status == .noSchedule ? Color.secondary : Color.primary)
        .frame(maxWidth: .infinity, minHeight: 36)
        .background {
            RoundedRectangle(cornerRadius: 6)
                .fill(day.status == .kept ? Color(uiColor: ShieldAppearance.tint).opacity(0.18) : .clear)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 6)
                .strokeBorder(day.status == .missed ? Color.secondary : .clear, lineWidth: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(date)、\(status)")
    }
}
