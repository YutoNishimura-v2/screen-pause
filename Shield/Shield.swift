import Foundation
import ManagedSettings
import ManagedSettingsUI
import UIKit

final class Shield: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        configuration(for: application.token)
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        configuration(for: application.token)
    }

    private func configuration(for token: ApplicationToken?) -> ShieldConfiguration {
        var state = try? ScreenTime.transaction { $0 }
        let now = Date.now
        let calendar = Calendar.current
        // Match the action's eligibility even when the relock callback has not refreshed storage.
        state?.reconcile(at: now, calendar: calendar)
        let strict = state?.isStrict(at: now, calendar: calendar) == true
        let pause = state?.pause(at: now, calendar: calendar) ?? .standard
        let pending = state?.activePending(at: now, calendar: calendar)
        let waitingForApp = pending != nil && pending?.app == token
        let canOpen = token != nil && state?.isBlocking(at: now, calendar: calendar) == true && !strict && state?.permit == nil
        let attempt = (state?.progress.unlockCount(at: now, calendar: calendar) ?? 0) + 1
        let showsAttempt = pause.isEscalating && !strict && state?.unlockFailed != true
        var subtitle: String
        if state == nil {
            subtitle = "設定を読み込めません。「ひと呼吸」を開き直してください。"
        } else if strict {
            subtitle = "制限時間が終わるまで、このアプリは開けません。"
        } else if state?.unlockFailed == true {
            subtitle = "一時解除できませんでした。もう一度お試しください。"
        } else if waitingForApp {
            // iOS can keep this configuration on screen across the wait boundary.
            subtitle = ShieldAppearance.unlockInstructions
        } else if state?.permit != nil {
            subtitle = "別のアプリを一時解除しています。"
        } else {
            let count = state?.progress.count(at: now, calendar: calendar) ?? 0
            subtitle = pause.message.isEmpty ? ShieldAppearance.stopPrompt(count: count) : pause.message
            if canOpen && pause.seconds > 0 {
                subtitle += "\n" + ShieldAppearance.unlockInstructions
            }
        }
        if showsAttempt, state?.permit == nil {
            subtitle = ShieldAppearance.attemptWaitLabel(attempt: attempt, seconds: pause.seconds) + "\n" + subtitle
        }
        return ShieldConfiguration(
            backgroundColor: .systemBackground,
            icon: ShieldAppearance.icon,
            title: .init(text: ShieldAppearance.title, color: .label),
            subtitle: .init(text: subtitle, color: .label),
            primaryButtonLabel: .init(text: ShieldAppearance.primary, color: .white),
            primaryButtonBackgroundColor: ShieldAppearance.tint,
            secondaryButtonLabel: canOpen ? .init(
                text: waitingForApp ? ShieldAppearance.unlock : ShieldAppearance.secondary(seconds: pause.seconds),
                color: .label
            ) : nil
        )
    }
}
