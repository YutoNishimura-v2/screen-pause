import UIKit

enum ShieldAppearance {
    static let title = "今、開きますか？"
    static let subtitle = "戻ると今日の記録に1回。"
    // iOS uses these visible labels for the system-rendered buttons.
    static let primary = "開かずに戻る"
    // Fixed (not dynamic) colours: the shield image and button are resolved once, so each
    // purple from the adopted app icon must read on both the white and black backgrounds.
    static let tint = UIColor(red: 88.0 / 255, green: 86.0 / 255, blue: 214.0 / 255, alpha: 1)
    static let icon = UIImage(systemName: "pause.fill", withConfiguration:
        UIImage.SymbolConfiguration(pointSize: 56, weight: .regular))?
        .withTintColor(UIColor(red: 101.0 / 255, green: 98.0 / 255, blue: 232.0 / 255, alpha: 1),
                       renderingMode: .alwaysOriginal)

    private static let accessMinutes = Int(PauseWindow.access) / 60
    static let unlock = "\(accessMinutes)分だけ開く"
    static let waiting = "待機中"
    static let unlockInstructions = "待機後にもう一度押すと、\(accessMinutes)分だけ開けます。"

    static func stopPrompt(count: Int) -> String {
        switch count {
        case 4: return "今日は4回戻れました。開かずに戻ると5回目です。"
        case 5: return "今日は5回、開かずに戻れました。"
        default: return subtitle
        }
    }

    static func secondary(seconds: Int) -> String {
        seconds == 0 ? unlock : "\(seconds)秒の待機を始める"
    }

    /// The escalating wait for today's Nth unlock, e.g. 「今日 3回目・40秒」.
    static func attemptWaitLabel(attempt: Int, seconds: Int) -> String {
        "今日 \(max(1, attempt))回目・\(max(0, seconds))秒"
    }

    /// One calm sentence with the remaining seconds, rendered by the app where timers can run.
    static func waitStatus(remainingSeconds: Int) -> String {
        remainingSeconds > 0
            ? "ひと呼吸おいています。あと\(remainingSeconds)秒"
            : "もう一度押すと開けます。"
    }
}
