import Foundation
import ManagedSettings
import OSLog

final class Action: ShieldActionDelegate {
    private static let logger = Logger(subsystem: "jp.screenpause.app", category: "shield")

    override func handle(
        action: ShieldAction,
        for application: ApplicationToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        do {
            let request = try ScreenTime.transaction(applyShields: true) { state -> SharedState.Request? in
                let now = Date.now
                let calendar = Calendar.current
                state.reconcile(at: now, calendar: calendar)

                guard state.isBlocking(at: now, calendar: calendar) else { return nil }
                switch action {
                case .primaryButtonPressed:
                    state.progress.giveUp(at: now, calendar: calendar)
                    if state.pending?.app == application { state.pending = nil }
                    return nil
                case .secondaryButtonPressed:
                    guard state.permit == nil, !state.isStrict(at: now, calendar: calendar) else { return nil }
                    let seconds = state.pause(at: now, calendar: calendar).seconds
                    if let pending = state.pending, pending.app == application,
                       pending.wait == Double(seconds),
                       PauseWindow.isPendingActive(requestedAt: pending.date, now: now, wait: pending.wait) {
                        return pending
                    }
                    let request = SharedState.Request(app: application, date: now, waitSeconds: seconds)
                    state.pending = request
                    state.unlockFailed = false
                    return request
                @unknown default:
                    return nil
                }
            }

            // Return promptly so iOS redraws the shield with the retry instruction.
            // The persisted request enforces the wait across extension launches.
            if let request, Date.now >= request.date.addingTimeInterval(request.wait) {
                Self.finish(request)
            }
            completionHandler(action == .secondaryButtonPressed ? .defer : .close)
        } catch {
            Self.logger.error("Could not handle shield action: \(String(describing: error), privacy: .public)")
            completionHandler(.defer)
        }
    }

    private static func finish(_ request: SharedState.Request) {
        do {
            try ScreenTime.transaction(applyShields: true) { state in
                let now = Date.now
                state.reconcile(at: now, calendar: .current)
                guard state.isBlocking(at: now), state.pending == request, state.permit == nil,
                      request.wait == Double(state.pause(at: now).seconds),
                      PauseWindow.canUnlock(requestedAt: request.date, now: now,
                                            strict: state.isStrict(at: now), wait: request.wait) else { return }

                state.pending = nil
                let expires = PauseWindow.expires(unlockedAt: now)
                // The monitoring API accepts whole seconds. Round the start up
                // so its callback cannot arrive before the stored expiry.
                let monitorStart = Date(timeIntervalSince1970: ceil(expires.timeIntervalSince1970))
                do {
                    try ScreenTime.registerRelock(at: monitorStart)
                    state.permit = .init(app: request.app, date: now)
                    state.session?.kept = false
                    state.progress.recordUnlock(at: now, calendar: .current)
                } catch {
                    state.unlockFailed = true
                    logger.error("Could not register re-lock: \(String(describing: error), privacy: .public)")
                }
            }
        } catch {
            logger.error("Could not finish pause: \(String(describing: error), privacy: .public)")
        }
    }
}
