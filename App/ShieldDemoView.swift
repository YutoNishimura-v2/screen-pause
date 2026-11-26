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
                        Image(uiImage: icon).accessibilityHidden(true)
                    }
                    Text(ShieldAppearance.title)
                        .font(.title.bold())
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("shield-title")
                    Text(ShieldAppearance.stopPrompt(count: count)).foregroundStyle(.secondary)
                    Button {
                        onStop()
                        dismiss()
                    } label: {
                        Text(ShieldAppearance.primary)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(Color(uiColor: ShieldAppearance.tint))
                    .accessibilityLabel(ShieldAppearance.primary)
                    .accessibilityIdentifier("shield-stop")

                    Button {
                        let now = Date.now
                        switch PauseWindow.pendingAction(
                            requestedAt: requestedAt, now: now, wait: Double(pause.seconds)
                        ) {
                        case .unlock:
                            dismiss()
                        case .restart:
                            requestedAt = now
                        case .waiting:
                            break
                        }
                    } label: {
                        Text(ShieldAppearance.secondary(seconds: pause.seconds))
                            .frame(minHeight: 44)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(ShieldAppearance.secondary(seconds: pause.seconds))
                    .accessibilityIdentifier("shield-open")
                    if let requestedAt {
                        // The app can run a timer here; the Shield extension shows a static label.
                        TimelineView(.periodic(from: requestedAt, by: 1)) { context in
                            switch PauseWindow.pendingAction(
                                requestedAt: requestedAt, now: context.date, wait: Double(pause.seconds)
                            ) {
                            case .waiting(let remaining):
                                Text(ShieldAppearance.waitStatus(remainingSeconds: remaining))
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            case .unlock:
                                Text(ShieldAppearance.waitStatus(remainingSeconds: 0))
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            case .restart:
                                EmptyView()
                            }
                        }
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
}
