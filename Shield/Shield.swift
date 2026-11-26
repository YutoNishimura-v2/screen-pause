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
        let state = try? ScreenTime.transaction { $0 }
        let now = Date.now
        let strict = state?.isStrict(at: now) == true
        let pause = state?.pause(at: now) ?? .standard
        // Shield extensions cannot run timers, so the escalating wait is a static label here;
        // the live countdown is rendered by the app (SetupView.homeForm and ShieldDemoView).
        let attempt = (state?.progress.unlockCount(at: now, calendar: .current) ?? 0) + 1
        let showsAttempt = pause.isEscalating && !strict && state?.unlockFailed != true
        var subtitle: String
        if state == nil {
            subtitle = "設定を読み込めません。「ひと呼吸」を開き直してください。"
        } else if strict {
            subtitle = "制限時間が終わるまで、このアプリは開けません。"
        } else if state?.unlockFailed == true {
            subtitle = "一時解除できませんでした。もう一度お試しください。"
        } else if let pending = state?.activePending(at: now), pending.app == token {
            subtitle = "ひと呼吸。時間が過ぎたら、もう一度押せます。"
        } else if state?.permit != nil {
            subtitle = "別のアプリを一時解除しています。"
        } else {
            let count = state?.progress.count(at: now, calendar: .current) ?? 0
            subtitle = pause.message.isEmpty ? ShieldAppearance.stopPrompt(count: count) : pause.message
        }
        if showsAttempt, state?.permit == nil {
            subtitle = ShieldAppearance.attemptWaitLabel(attempt: attempt, seconds: pause.seconds) + "\n" + subtitle
        }
        return ShieldConfiguration(
            backgroundColor: .systemBackground,
            icon: ShieldAppearance.icon,
            title: .init(text: ShieldAppearance.title, color: .label),
            subtitle: .init(text: subtitle, color: .secondaryLabel),
            primaryButtonLabel: .init(text: ShieldAppearance.primary, color: .white),
            primaryButtonBackgroundColor: ShieldAppearance.tint,
            secondaryButtonLabel: strict ? nil : token.map {
                _ in .init(text: ShieldAppearance.secondary(seconds: pause.seconds), color: .label)
            }
        )
    }
}
