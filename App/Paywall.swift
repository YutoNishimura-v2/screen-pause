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
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(headline)
                        .font(.title2.bold())
                        .accessibilityAddTraits(.isHeader)
                    Text("開かずに戻れた回数の履歴・週比較と連続日数")
                        .accessibilityIdentifier("paywall-progress-value")
                    Text("利用時間レポートは無料で使えます。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if demo { Text("デモ価格（仮の値）").foregroundStyle(.secondary) }
                }
                Section("Pro でできること") {
                    Text("厳格モードで制限中の一時解除を止める")
                    Text("開くたびに延びる待ち時間（最大\(PauseWindow.escalationCap)秒）")
                    Text("月ごとの達成カレンダー")
                    Text("複数の制限予定")
                    Text("待ち時間と制限画面のメッセージの変更")
                }
                Section {
                    ForEach(availablePlans) { option in
                        Button {
                            selected = option
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
                                    if demo || trial { Text("14日間無料").font(.footnote) }
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
                    }
                    if !demo && loading { ProgressView("プランを読み込み中") }
                    if !demo && !loading && products.count < ProProduct.allCases.count {
                        Button("プランを再読み込み") { Task { await load() } }
                    }
                }
                .disabled(busy)
                Section {
                    if demo || products[selected] != nil {
                        Text(purchaseTerms)
                            .font(.subheadline)
                            .accessibilityIdentifier("paywall-terms")
                        Button(hasTrial ? "14日間無料で始める" : "購入する") {
                            if let product = products[selected] { Task { await buy(product) } }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(demo || loading || busy)
                    }
                    if let message { Text(message).font(.footnote) }
                }
                Section {
                    Button("購入を復元") { Task { await restore() } }.disabled(demo || loading || busy)
                    LegalLinks()
                }
            }
            .navigationTitle("ひと呼吸 Pro")
            .navigationBarTitleDisplayMode(.inline)
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

    private func planName(_ option: ProProduct) -> some View {
        HStack {
            Image(systemName: selected == option ? "largecircle.fill.circle" : "circle")
                .accessibilityHidden(true)
            Text(option.title)
        }
    }

    private var hasTrial: Bool { selected == .yearly && (demo || trial) }

    private var yearlySavings: Int? {
        if demo { return 31 }
        guard let monthly = products[.monthly]?.price, let yearly = products[.yearly]?.price,
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
        // Mirrors the local test prices in ScreenPause.storekit.
        switch option {
        case .monthly: return "¥580／月"
        case .yearly: return "¥4,800／年"
        case .lifetime: return "¥7,800"
        }
    }

    private var purchaseTerms: String {
        let price = displayPrice(selected)
        let renewal = "期間終了の24時間前までに解約しない限り自動更新されます。購入確認時と更新時にApple Accountに請求されます。解約は端末のサブスクリプション設定から行えます。"
        switch selected {
        case .monthly: return "\(price)。\(renewal)"
        case .yearly where hasTrial:
            return "14日間無料。その後は \(price)。無料期間終了の24時間前までに解約すれば料金はかかりません。\(renewal)"
        case .yearly: return "\(price)。\(renewal)"
        case .lifetime: return "\(price) の一度のお支払いで、Pro を利用できます。"
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        message = nil
        do {
            let available = try await Product.products(for: ProProduct.allCases.map(\.rawValue))
            products = Dictionary(uniqueKeysWithValues: available.compactMap { product in
                ProProduct(rawValue: product.id).map { ($0, product) }
            })
            if !availablePlans.contains(selected), let fallback = availablePlans.first {
                selected = fallback
            }
            if !manuallySelected, products[.yearly] != nil {
                selected = .yearly
            }
            if let subscription = products[.yearly]?.subscription,
               let offer = subscription.introductoryOffer, offer.paymentMode == .freeTrial,
               (offer.period.unit == .week && offer.period.value * offer.periodCount == 2) ||
               (offer.period.unit == .day && offer.period.value * offer.periodCount == 14) {
                trial = await subscription.isEligibleForIntroOffer
            } else {
                trial = false
            }
            if products.count < ProProduct.allCases.count { message = "一部のプランを取得できませんでした。" }
        } catch {
            message = "プランを取得できませんでした。もう一度お試しください。"
        }
    }

    private func buy(_ product: Product) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        message = nil
        do {
            if try await store.purchase(product) { message = "購入の承認をお待ちください。" }
        } catch {
            message = "購入を確認できませんでした。「購入を復元」から確認できます。"
        }
    }

    private func restore() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        message = nil
        do {
            try await store.restore()
            if try ScreenTime.transaction({ $0.plan(at: .now) }) == .free {
                await load()
                message = "復元できる購入が見つかりませんでした。"
            }
        } catch {
            message = "購入を復元できませんでした。もう一度お試しください。"
        }
    }
}
