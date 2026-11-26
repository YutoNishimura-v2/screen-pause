import SwiftUI

struct CustomPauseView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var seconds: Int
    @State private var escalating: Bool
    @State private var message: String
    @State private var error: String?
    let onSave: (SharedState) -> Void

    init(preferences: PausePreferences, onSave: @escaping (SharedState) -> Void) {
        _seconds = State(initialValue: preferences.seconds)
        _escalating = State(initialValue: preferences.isEscalating)
        _message = State(initialValue: preferences.message)
        self.onSave = onSave
    }

    var body: some View {
        Form {
            Stepper("待ち時間 \(seconds)秒", value: $seconds, in: PausePreferences.secondsRange)
            Section {
                Toggle("開くたびに待ち時間を延ばす", isOn: $escalating)
                    .disabled(seconds == 0 && !escalating)
                    .onChange(of: seconds) { _, newValue in
                        if newValue == 0 { escalating = false }
                    }
            } footer: {
                if seconds == 0 {
                    Text("0秒では待ち時間を延ばせません。1秒以上にすると使えます。")
                } else {
                    let second = PauseWindow.waitSeconds(unlockCount: 2, base: seconds)
                    let third = PauseWindow.waitSeconds(unlockCount: 3, base: seconds)
                    Text("同じ日に開くたびに \(seconds)秒 → \(second)秒 → \(third)秒と延び（最大\(PauseWindow.escalationCap)秒）、午前0時に戻ります。")
                }
            }
            Section {
                TextField("制限画面のメッセージ", text: $message, axis: .vertical)
                    .lineLimit(2...4)
            } footer: {
                Text("80文字まで。空欄にすると標準の文に戻ります。")
            }
            Button("保存する", action: save)
                .disabled(!draft.isValid)
            if let error { Text(error).foregroundStyle(.secondary) }
        }
        .navigationTitle("待ち時間とメッセージ")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var trimmedMessage: String {
        message.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var draft: PausePreferences {
        PausePreferences(seconds: seconds, message: trimmedMessage, escalating: escalating)
    }

    private func save() {
        do {
            let preferences = PausePreferences(
                seconds: seconds,
                message: trimmedMessage,
                escalating: escalating
            )
            onSave(try ScreenTime.setCustomPause(preferences))
            dismiss()
        } catch ScreenTime.Failure.proRequired {
            error = "保存には Pro が必要です。"
        } catch {
            self.error = "設定を保存できませんでした。もう一度お試しください。"
        }
    }
}
