import SwiftUI

struct UsageSummary {
    struct Day {
        let date: Date
        let duration: TimeInterval?
    }

    let days: [Day]
    let week: TimeInterval?
    let saved: TimeInterval?
}

struct UsageReportView: View {
    let summary: UsageSummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("今週へらせた時間").font(.headline)
                    if let saved = summary.saved {
                        Text(duration(saved)).font(.largeTitle.weight(.semibold)).monospacedDigit()
                    } else {
                        Text("初週と今週の利用時間がそろうと表示されます。")
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("report-summary")
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

    private func duration(_ value: TimeInterval?) -> String {
        guard let value else { return "記録待ち" }
        let minutes = Int(max(0, value) / 60)
        return minutes < 60 ? "\(minutes)分" : "\(minutes / 60)時間\(minutes % 60)分"
    }
}
