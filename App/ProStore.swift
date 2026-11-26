import Foundation
import Observation
import OSLog
import StoreKit

enum ProProduct: String, CaseIterable, Identifiable {
    case monthly = "jp.screenpause.app.pro.monthly"
    case yearly = "jp.screenpause.app.pro.yearly"
    case lifetime = "jp.screenpause.app.pro.lifetime"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .monthly: "月額"
        case .yearly: "年額"
        case .lifetime: "買い切り"
        }
    }

    func price(_ product: Product) -> String {
        switch self {
        case .monthly: "\(product.displayPrice)／月"
        case .yearly: "\(product.displayPrice)／年"
        case .lifetime: product.displayPrice
        }
    }

}

@MainActor @Observable
final class ProStore {
    private(set) var revision = 0
    private(set) var accessError: String?
    @ObservationIgnored private var pendingRefresh: Task<Bool, Never>?

    enum PurchaseFailure: Error {
        case unverified
        case accessUnavailable
    }

    func listen() async {
        for await update in Transaction.updates {
            guard case .verified(let transaction) = update,
                  ProProduct(rawValue: transaction.productID) != nil else { continue }
            if await refresh() { await transaction.finish() }
        }
    }

    @discardableResult func refresh() async -> Bool {
        let previous = pendingRefresh
        let task = Task {
            _ = await previous?.value
            return await self.applyEntitlements()
        }
        pendingRefresh = task
        return await task.value
    }

    private func applyEntitlements() async -> Bool {
        var access: ProAccess?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  let product = ProProduct(rawValue: transaction.productID),
                  transaction.revocationDate == nil, !transaction.isUpgraded else { continue }
            if product == .lifetime {
                access = ProAccess(expires: nil, willAutoRenew: nil)
                break
            }
            if let subscription = await subscriptionAccess(for: transaction),
               let end = subscription.projectedEnd, end > (access?.projectedEnd ?? .distantPast) {
                access = subscription
            }
        }
        do {
            _ = try ScreenTime.updateAccess(access)
            accessError = nil
            revision += 1
            return true
        } catch {
            accessError = "購入状況を反映できませんでした。もう一度お試しください。"
            return false
        }
    }

    private func subscriptionAccess(for transaction: Transaction) async -> ProAccess? {
        guard let end = transaction.expirationDate else { return nil }
        do {
            if let group = transaction.subscriptionGroupID {
                let statuses = try await Product.SubscriptionInfo.status(for: group)
                for status in statuses {
                    guard case .verified(let current) = status.transaction, current.id == transaction.id,
                          case .verified(let renewal) = status.renewalInfo else { continue }
                    if status.state == .inGracePeriod {
                        return ProAccess(expires: renewal.gracePeriodExpirationDate ?? end, willAutoRenew: false)
                    }
                    return ProAccess(expires: end, willAutoRenew: status.state == .subscribed && renewal.willAutoRenew)
                }
            }
        } catch {
            Logger(subsystem: "jp.screenpause.app", category: "store")
                .error("Could not check subscription renewal: \(String(describing: error), privacy: .public)")
        }
        return ProAccess(expires: end, willAutoRenew: nil)
    }

    func purchase(_ product: Product) async throws -> Bool {
        switch try await product.purchase() {
        case .success(.verified(let transaction)):
            guard await refresh() else { throw PurchaseFailure.accessUnavailable }
            await transaction.finish()
            return false
        case .success(.unverified):
            throw PurchaseFailure.unverified
        case .pending:
            return true
        case .userCancelled:
            return false
        @unknown default:
            throw PurchaseFailure.unverified
        }
    }

    func restore() async throws {
        try await AppStore.sync()
        guard await refresh() else { throw PurchaseFailure.accessUnavailable }
    }
}
