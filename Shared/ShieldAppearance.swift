import UIKit

enum ShieldAppearance {
    static let title = "今、開きますか？"
    static let subtitle = "ゆっくりひと呼吸。開かずに戻ると、今日の回数に加わります。"
    // iOS uses these visible labels for the system-rendered buttons.
    static let primary = "開かずに戻る"
    static let tint = UIColor.systemIndigo
    static let icon = UIImage(systemName: "pause.circle", withConfiguration:
        UIImage.SymbolConfiguration(pointSize: 56, weight: .regular))?
        .withTintColor(.label, renderingMode: .alwaysOriginal)

    static func stopPrompt(count: Int) -> String {
        switch count {
        case 4: return "今日は4回戻れました。開かずに戻ると5回目です。"
        case 5: return "今日は5回、開かずに戻れました。"
        default: return subtitle
        }
    }

    static func secondary(seconds: Int) -> String {
        seconds == 0 ? "そのまま開く" : "\(seconds)秒待って開く"
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
