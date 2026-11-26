import OSLog
import SwiftUI
import WidgetKit

@main
struct PauseWidget: Widget {
    private let kind = "dailyProgress"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProgressProvider()) { entry in
            ProgressWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("ひと呼吸")
        .description("今日やめた回数と進行中の制限を表示します。")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}

struct ProgressEntry: TimelineEntry {
    let date: Date
    let count: Int?
    let status: String

    init(date: Date, count: Int?, status: String) {
        self.date = date
        self.count = count
        self.status = status
    }

    init(state: SharedState, date: Date, calendar: Calendar) {
        let status: String
        if state.settings == nil {
            status = "アプリで制限を設定"
        } else if let end = state.focusEnd, date < end {
            status = "集中時間中"
        } else {
            status = state.isBlocking(at: date, calendar: calendar) ? "制限中" : "次の制限を待機中"
        }
        self.init(date: date, count: state.progress.count(at: date, calendar: calendar), status: status)
    }
}

struct ProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProgressEntry {
        .init(date: .now, count: 0, status: "次の制限を待機中")
    }

    func getSnapshot(in context: Context, completion: @escaping (ProgressEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : timeline().entries[0])
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProgressEntry>) -> Void) {
        completion(timeline())
    }

    private func timeline() -> Timeline<ProgressEntry> {
        let now = Date.now
        let calendar = Calendar.current
        let midnight = UsagePeriods.nextDay(after: now, calendar: calendar)
        do {
            let state = try ScreenTime.readWidgetState()
            let dates = WidgetTimes.entries(
                now: now, midnight: midnight, calendar: calendar,
                schedules: state.settings?.schedules ?? [], focusEnd: state.focusEnd,
                proEnd: state.proAccess?.projectedEnd
            )
            let entries = dates.map { ProgressEntry(state: state, date: $0, calendar: calendar) }
            return Timeline(entries: entries, policy: .atEnd)
        } catch {
            Logger(subsystem: "jp.screenpause.app", category: "widget")
                .error("Could not read widget state: \(String(describing: error), privacy: .public)")
            return Timeline(
                entries: [.init(date: now, count: nil, status: "記録を読み込めません")],
                policy: .after(now.addingTimeInterval(15 * 60))
            )
        }
    }
}

struct ProgressWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ProgressEntry

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 0) {
            Text("今日やめた回数").font(.caption)
            if let count = entry.count {
                Text("\(count)回")
                    .font(family == .systemSmall ? .title.bold() : .headline)
                    .monospacedDigit()
                    .widgetAccentable()
            }
            Text(entry.status).font(.caption)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .privacySensitive()
    }
}
