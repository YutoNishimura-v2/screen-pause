import DeviceActivity
import OSLog

final class Monitor: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        if ScreenTime.handles(activity) { refresh() }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        if ScreenTime.handles(activity) { refresh() }
    }

    private func refresh() {
        do {
            _ = try ScreenTime.refresh()
        } catch {
            Logger(subsystem: "jp.screenpause.app", category: "monitor")
                .error("Could not reconcile Screen Time state: \(String(describing: error), privacy: .public)")
        }
    }
}
