import SwiftUI

struct UsageSummary {
    struct Day {
        let date: Date
        let duration: TimeInterval?
    }

    struct AppUsage {
        let name: String
        let duration: TimeInterval
    }

    let days: [Day]
    let week: TimeInterval?
    let saved: TimeInterval?
    let earlyDelta: TimeInterval?
    let apps: [AppUsage]
    let hourly: [TimeInterval]
}

struct UsageReportView: View {
    let summary: UsageSummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    if let saved = summary.saved {
                        Text("今週へらせた時間").font(.headline)
                        Text(duration(saved)).font(.largeTitle.weight(.semibold)).monospacedDigit()
                    } else if let delta = summary.earlyDelta {
                        Text("昨日の合計との差").font(.headline)
                        Text(deltaLabel(delta)).font(.largeTitle.weight(.semibold)).monospacedDigit()
                        Text("今日の利用時間は途中経過です。").font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Text("利用時間の比較").font(.headline)
                        Text("昨日と今日の記録がそろうと表示されます。")
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("report-summary")
                if !summary.apps.isEmpty {
                    Text("今週よく使うアプリ").font(.headline).accessibilityAddTraits(.isHeader)
                    ForEach(summary.apps.indices, id: \.self) { index in
                        let app = summary.apps[index]
                        LabeledContent(app.name, value: duration(app.duration))
                    }
                }
                if summary.hourly.contains(where: { $0 > 0 }) {
                    Text("今週の時間帯別利用").font(.headline).accessibilityAddTraits(.isHeader)
                    ForEach(summary.hourly.indices, id: \.self) { hour in
                        if summary.hourly[hour] > 0 {
                            LabeledContent("\(hour)時台", value: duration(summary.hourly[hour]))
                        }
                    }
                }
                DisclosureGroup("利用時間の内訳") {
                    LabeledContent("今週の合計", value: duration(summary.week))
                    ForEach(summary.days, id: \.date) { day in
                        LabeledContent(
                            day.date.formatted(.dateTime.month().day().locale(Locale(identifier: "ja_JP"))),
                            value: duration(day.duration)
                        )
                    }
                    Text("月曜始まり。比較には、初週と今週の同じ日数分を使います。")
                        .font(.footnote).foregroundStyle(.secondary)
                    Text("初週の記録は、今週と直前5週の範囲で参照します。")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private func deltaLabel(_ delta: TimeInterval) -> String {
        guard abs(delta) >= 60 else { return "差は1分未満" }
        return duration(abs(delta)) + (delta < 0 ? "少ない" : "多い")
    }

    private func duration(_ value: TimeInterval?) -> String {
        guard let value else { return "記録待ち" }
        let minutes = Int(max(0, value) / 60)
        return minutes < 60 ? "\(minutes)分" : "\(minutes / 60)時間\(minutes % 60)分"
    }
}
