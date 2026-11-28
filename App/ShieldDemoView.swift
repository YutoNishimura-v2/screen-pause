import SwiftUI

struct ShieldDemoView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var requestedAt: Date?
    let count: Int
    let onStop: () -> Void

    private let pause = PausePreferences.standard

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 16) {
                    if let icon = ShieldAppearance.icon {
                        Image(uiImage: icon)
                            .renderingMode(.original)
                            .accessibilityHidden(true)
                    }
                    Text(ShieldAppearance.title)
                        .font(.title.bold())
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("shield-title")
                    Text(ShieldAppearance.stopPrompt(count: count))
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        onStop()
                        dismiss()
                    } label: {
                        Text(ShieldAppearance.primary)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color(uiColor: ShieldAppearance.tint))
                    .accessibilityLabel(ShieldAppearance.primary)
                    .accessibilityIdentifier("shield-stop")

                    // The app can run a timer here; the Shield extension shows a static label.
                    TimelineView(.periodic(from: requestedAt ?? .now, by: 1)) { context in
                        let phase = PauseWindow.pendingAction(
                            requestedAt: requestedAt, now: context.date, wait: Double(pause.seconds)
                        )
                        VStack(spacing: 4) {
                            Button {
                                let now = Date.now
                                switch PauseWindow.pendingAction(
                                    requestedAt: requestedAt, now: now, wait: Double(pause.seconds)
                                ) {
                                case .unlock:
                                    dismiss()
                                case .restart:
                                    if pause.seconds == 0 {
                                        dismiss()
                                    } else {
                                        requestedAt = now
                                    }
                                case .waiting:
                                    break
                                }
                            } label: {
                                Text(openLabel(for: phase))
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Color.primary)
                                    .frame(minHeight: 44)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .buttonStyle(.borderless)
                            .disabled(isWaiting(phase))
                            .accessibilityIdentifier("shield-open")

                            switch phase {
                            case .waiting(let remaining):
                                Text(ShieldAppearance.waitStatus(remainingSeconds: remaining))
                                    .monospacedDigit()
                                    .accessibilityIdentifier("shield-wait-status")
                            case .restart where pause.seconds > 0:
                                Text(ShieldAppearance.unlockInstructions)
                            default:
                                EmptyView()
                            }
                        }
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .multilineTextAlignment(.center)
                .padding(24)
                .frame(maxWidth: .infinity, minHeight: geometry.size.height)
            }
        }
        .navigationTitle("制限画面のプレビュー")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func openLabel(for phase: PendingAction) -> String {
        switch phase {
        case .restart: return ShieldAppearance.secondary(seconds: pause.seconds)
        case .waiting: return ShieldAppearance.waiting
        case .unlock: return ShieldAppearance.unlock
        }
    }

    private func isWaiting(_ phase: PendingAction) -> Bool {
        if case .waiting = phase { return true }
        return false
    }
}
