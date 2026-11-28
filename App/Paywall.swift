import StoreKit
import SwiftUI

@MainActor
struct Paywall: View {
    let reason: PaywallReason
    let store: ProStore
    var demo = false
    @Environment(\.dismiss) private var dismiss
    @State private var products: [ProProduct: Product] = [:]
    @State private var selected = ProProduct.yearly
    @State private var manuallySelected = false
    @State private var trial = false
    @State private var loading = true
    @State private var operation: Operation?
    @State private var loadMessage: String?
    @State private var feedback: Feedback?

    /// The StoreKit request in flight; demo mode never starts one.
    private enum Operation { case purchase, restore }
    private struct Feedback {
        let operation: Operation
        let message: String
    }
    private var busy: Bool { operation != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(headline)
                        .font(.title2.bold())
                        .accessibilityAddTraits(.isHeader)
                    Text(reasonSummary)
                        .font(.subheadline)
                        .accessibilityIdentifier("paywall-example")
                    if reason == .progressHistory {
                        Text("開かずに戻れた回数の履歴・週比較と連続日数")
                            .accessibilityIdentifier("paywall-progress-value")
                    }
                    Text("利用時間レポートは無料で使えます。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section {
                    ForEach(availablePlans) { option in
                        Button {
                            selectPlan(option)
                            manuallySelected = true
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                ViewThatFits(in: .horizontal) {
                                    HStack {
                                        planName(option)
                                            .fixedSize(horizontal: true, vertical: false)
                                        Spacer(minLength: 8)
                                        Text(displayPrice(option)).fixedSize()
                                    }
                                    VStack(alignment: .leading, spacing: 4) {
                                        planName(option)
                                        Text(displayPrice(option))
                                    }
                                }
                                if option == .yearly {
                                    if demo || (!loading && trial) { Text("14日間無料").font(.footnote) }
                                    if let savings = yearlySavings {
                                        Text("月額比 約\(savings)%お得").font(.footnote)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected == option ? .isSelected : [])
                        .accessibilityValue(selected == option ? "選択中" : "未選択")
                        .accessibilityIdentifier(option == .monthly ? "paywall-monthly" : "paywall-yearly")
                    }
                    if !demo && loading {
                        if availablePlans.isEmpty {
                            ForEach(ProProduct.allCases) { option in
                                HStack {
                                    Text(option.title)
                                    Spacer()
                                    Text("価格を確認中…").foregroundStyle(.secondary)
                                }
                            }
                        }
                        ProgressView("プランを読み込み中")
                    }
                    if !demo && !loading && products.count < ProProduct.allCases.count {
                        Button("プランを再読み込み") {
                            Task {
                                guard !loading, !busy else { return }
                                await load()
                            }
                        }
                    }
                    if let loadMessage { Text(loadMessage).font(.footnote) }
                    if demo || (!loading && products[selected] != nil) {
                        if demo {
                            Text("デモ表示：購入と復元は行われません")
                                .font(.footnote.weight(.semibold))
                                .accessibilityIdentifier("paywall-demo")
                        }
                        Text(purchaseTerms)
                            .font(.subheadline.weight(.semibold))
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("paywall-terms")
                        Button(hasTrial ? "14日間無料で始める" : "購入する") {
                            if demo {
                                feedback = Feedback(operation: .purchase, message: "デモ表示のため購入は行われません。")
                            } else if let product = products[selected] {
                                Task { await buy(product) }
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .buttonStyle(.borderedProminent)
                        .disabled((!demo && loading) || busy)
                        .accessibilityIdentifier("paywall-purchase")
                        if let feedback, feedback.operation == .purchase {
                            Text(feedback.message)
                                .font(.footnote)
                                .accessibilityIdentifier("paywall-message")
                        }
                        DisclosureGroup("請求と解約の詳細") {
                            Text(billingDetails)
                                .font(.subheadline)
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("paywall-billing-details")
                        }
                        .accessibilityIdentifier("paywall-billing")
                    }
                    if operation == .purchase { ProgressView("購入を確認中") }
                }
                .disabled(busy)
                Section {
                    Button("購入を復元") {
                        if demo {
                            feedback = Feedback(operation: .restore, message: "デモ表示のため復元は行われません。")
                        } else {
                            Task { await restore() }
                        }
                    }
                    .frame(minHeight: 44)
                    .disabled((!demo && loading) || busy)
                    .accessibilityIdentifier("paywall-restore")
                    if operation == .restore { ProgressView("購入を復元中") }
                    if let feedback, feedback.operation == .restore {
                        Text(feedback.message)
                            .font(.footnote)
                            .accessibilityIdentifier("paywall-restore-message")
                    }
                    LegalLinks()
                }
                Section {
                    DisclosureGroup("Pro でできること") {
                        Text("厳格モードで制限中の一時解除を止める")
                        Text("開くたびに延びる待ち時間（最大\(PauseWindow.escalationCap)秒）")
                        Text("月ごとの達成カレンダー")
                        Text("複数の制限予定")
                        Text("開かずに戻れた回数の履歴・週比較と連続日数")
                        Text("待ち時間と制限画面のメッセージの変更")
                    }
                    .accessibilityIdentifier("paywall-features")
                }
            }
            .accessibilityIdentifier("paywall-form")
            .navigationTitle("ひと呼吸 Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(uiColor: .systemGroupedBackground), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { dismiss() }.disabled(busy)
                }
            }
            .interactiveDismissDisabled(busy)
            .task { if !demo { await load() } }
            .onChange(of: store.revision) {
                guard !demo else { return }
                if (try? ScreenTime.transaction({ $0.plan(at: .now) })) == .pro { dismiss() }
            }
        }
    }

    private var headline: String {
        switch reason {
        case .secondSchedule: "時間帯を追加する"
        case .progressHistory: "回数の履歴と連続日数を見る"
        case .customPause: "待ち時間とメッセージを変える"
        case .strictMode: "制限中の一時解除を止める"
        }
    }

    private var reasonSummary: String {
        switch reason {
        case .secondSchedule: "例：平日 20:00〜22:00 と土日 9:00〜11:00 を別々の予定で制限できます。"
        case .progressHistory: "例：今週 12回・先週 8回、連続 5日のように変化を振り返れます。"
        case .customPause: "例：待ち時間を30秒にし、制限画面に「いまは勉強の時間」と表示できます。"
        case .strictMode: "例：20:00〜22:00 の制限中は一時解除できず、決めた時間を最後まで守れます。"
        }
    }

    private func planName(_ option: ProProduct) -> some View {
        HStack {
            Image(systemName: selected == option ? "largecircle.fill.circle" : "circle")
                .accessibilityHidden(true)
            Text(option.title)
        }
    }

    private var hasTrial: Bool { selected == .yearly && (demo || trial) }

    private var yearlySavings: Int? {
        if !demo {
            guard let monthly = products[.monthly], let yearly = products[.yearly],
                  monthly.priceFormatStyle.currencyCode == yearly.priceFormatStyle.currencyCode else { return nil }
        }
        let monthly = products[.monthly]?.price ?? (demo ? Decimal(ProProduct.monthly.jpyPrice) : nil)
        let yearly = products[.yearly]?.price ?? (demo ? Decimal(ProProduct.yearly.jpyPrice) : nil)
        guard let monthly, let yearly,
              monthly > 0, yearly < monthly * 12 else { return nil }
        let savings = (1 - yearly / (monthly * 12)) * 100
        let percent = Int(NSDecimalNumber(decimal: savings).doubleValue.rounded())
        return percent > 0 ? percent : nil
    }

    private var availablePlans: [ProProduct] {
        ProProduct.allCases.filter { demo || products[$0] != nil }
    }

    private func displayPrice(_ option: ProProduct) -> String {
        if let product = products[option] { return option.price(product) }
        guard demo else { return "" }
        return option.confirmedDisplayPrice
    }

    private var purchaseTerms: String {
        let price = displayPrice(selected)
        return hasTrial ? "14日間無料。その後は \(price)で自動更新" : "\(price)で自動更新"
    }

    private var billingDetails: String {
        let charge = hasTrial
            ? "無料期間終了の24時間前までに解約すれば料金はかかりません。無料期間終了後と更新時にApple Accountに請求されます。"
            : "購入確認時と更新時にApple Accountに請求されます。"
        return charge + "期間終了の24時間前までに解約しない限り自動更新されます。解約は端末のサブスクリプション設定から行えます。"
    }

    private func selectPlan(_ option: ProProduct) {
        if selected != option, feedback?.operation == .purchase { feedback = nil }
        selected = option
    }

    private func load() async {
        loading = true
        defer { loading = false }
        loadMessage = nil
        if feedback?.operation == .purchase { feedback = nil }
        do {
            let available = try await Product.products(for: ProProduct.allCases.map(\.rawValue))
            products = Dictionary(uniqueKeysWithValues: available.compactMap { product in
                ProProduct(rawValue: product.id).map { ($0, product) }
            })
            if !manuallySelected, products[.yearly] != nil {
                selectPlan(.yearly)
            } else if !availablePlans.contains(selected), let fallback = availablePlans.first {
                selectPlan(fallback)
            }
            if let subscription = products[.yearly]?.subscription,
               let offer = subscription.introductoryOffer, offer.paymentMode == .freeTrial,
               (offer.period.unit == .week && offer.period.value * offer.periodCount == 2) ||
               (offer.period.unit == .day && offer.period.value * offer.periodCount == 14) {
                trial = await subscription.isEligibleForIntroOffer
            } else {
                trial = false
            }
            if products.count < ProProduct.allCases.count { loadMessage = "一部のプランを取得できませんでした。" }
        } catch {
            loadMessage = "プランを取得できませんでした。もう一度お試しください。"
        }
    }

    private func buy(_ product: Product) async {
        guard !busy, !loading else { return }
        operation = .purchase
        defer { operation = nil }
        feedback = nil
        do {
            if try await store.purchase(product) {
                feedback = Feedback(operation: .purchase, message: "購入の承認をお待ちください。")
            }
        } catch {
            feedback = Feedback(operation: .purchase, message: "購入を確認できませんでした。「購入を復元」から確認できます。")
        }
    }

    private func restore() async {
        guard !busy, !loading else { return }
        operation = .restore
        defer { operation = nil }
        feedback = nil
        do {
            try await store.restore()
            if try ScreenTime.transaction({ $0.plan(at: .now) }) == .free {
                await load()
                feedback = Feedback(operation: .restore, message: "復元できる購入が見つかりませんでした。")
            }
        } catch {
            feedback = Feedback(operation: .restore, message: "購入を復元できませんでした。もう一度お試しください。")
        }
    }
}
