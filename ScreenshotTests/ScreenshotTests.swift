import XCTest

final class ScreenshotTests: XCTestCase {
    @MainActor func testLightScreens() {
        captureScreens(appearance: "light")
    }

    @MainActor func testDarkScreens() {
        captureScreens(appearance: "dark")
    }

    @MainActor func testPaywallAtAX5Light() {
        exerciseAccessiblePaywall(appearance: "light")
    }

    @MainActor func testPaywallAtAX5Dark() {
        exerciseAccessiblePaywall(appearance: "dark")
    }

    @MainActor func testPaywallDemoRestoreThenPlanChangeThenPurchase() {
        let app = openDemoHome(appearance: "light", accessibilitySize: false)
        let bar = openPaywall(in: app)
        let restore = app.buttons["paywall-restore"]
        let restoreMessage = app.staticTexts["paywall-restore-message"]
        revealBelowBar(restore, bar: bar, in: app)
        XCTAssertTrue(restore.isEnabled)
        restore.tap()
        revealBelowBar(restoreMessage, bar: bar, in: app)
        XCTAssertEqual(restoreMessage.label, "デモ表示のため復元は行われません。")

        let monthly = app.buttons["paywall-monthly"]
        revealBelowBar(monthly, bar: bar, in: app, scrollingUp: true)
        monthly.tap()
        let purchase = app.buttons["paywall-purchase"]
        revealBelowBar(purchase, bar: bar, in: app)
        purchase.tap()
        let message = app.staticTexts["paywall-message"]
        revealBelowBar(message, bar: bar, in: app)
        XCTAssertEqual(message.label, "デモ表示のため購入は行われません。")
        revealBelowBar(element("利用規約", in: app), bar: bar, in: app)
        XCTAssertFalse(restoreMessage.exists)
    }

    @MainActor func testPaywallDemoPurchaseThenRestore() {
        let app = openDemoHome(appearance: "light", accessibilitySize: false)
        let bar = openPaywall(in: app)
        let purchase = app.buttons["paywall-purchase"]
        revealBelowBar(purchase, bar: bar, in: app)
        XCTAssertTrue(purchase.isEnabled)
        purchase.tap()
        let message = app.staticTexts["paywall-message"]
        revealBelowBar(message, bar: bar, in: app)
        XCTAssertEqual(message.label, "デモ表示のため購入は行われません。")

        let restore = app.buttons["paywall-restore"]
        revealBelowBar(restore, bar: bar, in: app)
        restore.tap()
        let restoreMessage = app.staticTexts["paywall-restore-message"]
        revealBelowBar(restoreMessage, bar: bar, in: app)
        XCTAssertEqual(restoreMessage.label, "デモ表示のため復元は行われません。")
        revealBelowBar(element("paywall-billing", in: app), bar: bar, in: app, scrollingUp: true)
        XCTAssertFalse(message.exists)
    }

    @MainActor func testPaywallDemoPlanChangeClearsPurchaseFeedback() {
        let app = openDemoHome(appearance: "light", accessibilitySize: false)
        let bar = openPaywall(in: app)
        let purchase = app.buttons["paywall-purchase"]
        revealBelowBar(purchase, bar: bar, in: app)
        purchase.tap()
        let message = app.staticTexts["paywall-message"]
        revealBelowBar(message, bar: bar, in: app)

        let monthly = app.buttons["paywall-monthly"]
        revealBelowBar(monthly, bar: bar, in: app, scrollingUp: true)
        monthly.tap()
        revealBelowBar(element("paywall-billing", in: app), bar: bar, in: app)
        XCTAssertFalse(message.exists)
    }

    func testPaywallRejectsPartialTermsInFormViewport() {
        let form = CGRect(x: 0, y: 56, width: 390, height: 788)
        let viewport = paywallViewport(form: form, barBottom: 96)
        let partial = CGRect(x: 24, y: 790, width: 342, height: 600)
        XCTAssertFalse(fullyVisible(partial, in: viewport))
        let clippedAtBottom = partial.offsetBy(dx: 0, dy: -545)
        for target in [PaywallRowTarget.whole, .beginning, .end] {
            XCTAssertFalse(isPaywallTargetVisible(clippedAtBottom, in: viewport, target: target))
        }
        XCTAssertTrue(fullyVisible(partial.offsetBy(dx: 0, dy: -560), in: viewport))
        XCTAssertFalse(fullyVisible(partial.offsetBy(dx: 0, dy: -700), in: viewport))
        let shorterForm = CGRect(x: 0, y: 56, width: 390, height: 768)
        XCTAssertFalse(fullyVisible(partial.offsetBy(dx: 0, dy: -560),
                                    in: paywallViewport(form: shorterForm, barBottom: 96)))
        XCTAssertGreaterThan(paywallScrollDistance(for: partial, in: viewport), 0)
        let clippedAtTop = partial.offsetBy(dx: 0, dy: -700)
        XCTAssertLessThan(paywallScrollDistance(for: clippedAtTop, in: viewport), 0)
    }

    func testPaywallRevealsOversizedBillingDetailsFromBeginningToEnd() {
        let viewport = CGRect(x: 0, y: 106, width: 402, height: 768)
        let beginning = CGRect(x: 24, y: 200, width: 342, height: 820)
        let tail = paywallRevealFrame(beginning, in: viewport, target: .end)
        let distance = paywallScrollDistance(for: tail, in: viewport)
        XCTAssertGreaterThan(distance, 0)
        let end = beginning.offsetBy(dx: 0, dy: -distance)
        XCTAssertFalse(fullyVisible(beginning, in: viewport))
        XCTAssertFalse(fullyVisible(end, in: viewport))
        XCTAssertTrue(isPaywallTargetVisible(beginning, in: viewport, target: .beginning))
        XCTAssertFalse(isPaywallTargetVisible(beginning, in: viewport, target: .end))
        XCTAssertTrue(isPaywallTargetVisible(end, in: viewport, target: .end))
        XCTAssertFalse(isPaywallTargetVisible(end, in: viewport, target: .beginning))
        let aboveViewport = end.offsetBy(dx: 0, dy: -800)
        XCTAssertFalse(isPaywallTargetVisible(aboveViewport, in: viewport, target: .end))
        XCTAssertLessThan(paywallScrollDistance(for: paywallRevealFrame(aboveViewport, in: viewport, target: .end),
                                               in: viewport), 0)
    }

    func testPaywallScrollsForCaptureEvenWhenPurchaseFitsInitially() {
        let viewport = CGRect(x: 0, y: 96, width: 390, height: 748)
        let monthly = CGRect(x: 24, y: 290, width: 342, height: 60)
        let purchase = CGRect(x: 24, y: 620, width: 342, height: 52)
        XCTAssertTrue(fullyVisible(purchase, in: viewport))
        let initialGap = monthly.minY - viewport.minY
        XCTAssertFalse(isAlignedForTermsCapture(gap: initialGap, initialGap: initialGap))
        XCTAssertFalse(isAlignedForTermsCapture(gap: -4, initialGap: initialGap))
        XCTAssertFalse(isAlignedForTermsCapture(gap: 14, initialGap: 14))
        XCTAssertTrue(isAlignedForTermsCapture(gap: 14, initialGap: initialGap))
    }

    @MainActor func testFirstBlockDemo() {
        exerciseFirstBlockDemo(appearance: "light", accessibilitySize: false)
    }

    @MainActor func testFirstBlockDemoInDark() {
        exerciseFirstBlockDemo(appearance: "dark", accessibilitySize: false)
    }

    @MainActor func testFirstBlockDemoAtAX5Light() {
        exerciseFirstBlockDemo(appearance: "light", accessibilitySize: true)
    }

    @MainActor func testFirstBlockDemoAtAX5Dark() {
        exerciseFirstBlockDemo(appearance: "dark", accessibilitySize: true)
    }

    @MainActor func testFirstBlockRequiresFreshConsentAfterMinuteChanges() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--screenshot-demo", "--screenshot-cross-minute"]
        app.launch()

        let permission = app.buttons["setup-permission"]
        reveal(permission, in: app)
        permission.tap()
        let terms = element("setup-first-run-terms", in: app)
        XCTAssertTrue(terms.waitForExistence(timeout: 8))
        XCTAssertTrue(terms.label.contains("毎日 20:00〜21:00"))
        let start = app.buttons["setup-start"]
        reveal(start, in: app)
        start.tap()

        XCTAssertTrue(app.staticTexts["時刻が変わりました。更新した時間を確認して、もう一度押してください。"].exists)
        XCTAssertTrue(terms.label.contains("21:01まで"))
        XCTAssertTrue(terms.label.contains("毎日 20:01〜21:01"))
        XCTAssertTrue(start.isEnabled)
        XCTAssertFalse(element("home-count", in: app).exists)
        start.tap()
        XCTAssertTrue(element("home-count", in: app).waitForExistence(timeout: 8))
        app.buttons["設定"].tap()
        XCTAssertTrue(app.buttons["毎日 20:01〜21:01"].waitForExistence(timeout: 8))
    }

    @MainActor private func exerciseFirstBlockDemo(appearance: String, accessibilitySize: Bool) {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--screenshot-demo", "--screenshot-appearance", appearance]
        if accessibilitySize { app.launchArguments.append("--screenshot-ax5") }
        app.launch()

        let clock = ContinuousClock()
        let started = clock.now
        var taps = 0
        for identifier in ["setup-permission", "setup-start", "home-shield"] {
            let control = element(identifier, in: app)
            reveal(control, in: app)
            control.tap()
            taps += 1
            if identifier == "setup-permission" {
                if accessibilitySize {
                    verifyDemoSelection(start: app.buttons["setup-start"], in: app, accessibilitySize: true)
                } else {
                    let selected = element("setup-selection-count", in: app)
                    reveal(selected, in: app)
                    XCTAssertEqual(selected.label, "選択済み 1件")
                }
            }
        }
        XCTAssertTrue(app.staticTexts["shield-title"].waitForExistence(timeout: 8))
        let elapsed = started.duration(to: clock.now)
        if !accessibilitySize {
            let measurement = XCTAttachment(string: "初回の制限プレビューまで \(taps)タップ、\(elapsed)")
            measurement.lifetime = .keepAlways
            add(measurement)
            XCTAssertTrue(elapsed < .seconds(60))
        }
        XCTAssertEqual(taps, 3)

        let stop = app.buttons["shield-stop"]
        reveal(stop, in: app)
        XCTAssertEqual(stop.label, "開かずに戻る")
        let open = app.buttons["shield-open"]
        reveal(open, in: app)
        XCTAssertEqual(open.label, "10秒の待機を始める")
        open.tap()
        let waiting = app.staticTexts["shield-wait-status"]
        XCTAssertTrue(waiting.waitForExistence(timeout: 4))
        XCTAssertTrue(waiting.label.contains("あと"))
        XCTAssertEqual(open.label, "待機中")
        XCTAssertFalse(open.isEnabled)
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", "5分だけ開く"), object: open
        )
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
        reveal(open, in: app)
        XCTAssertTrue(open.isEnabled)
        open.tap()
        let count = element("home-count", in: app)
        reveal(count, in: app, scrollingUp: true)
        XCTAssertEqual(count.label, "今日、開かずに戻れた回数、0回")

        let shield = element("home-shield", in: app)
        reveal(shield, in: app)
        shield.tap()
        reveal(open, in: app)
        XCTAssertEqual(open.label, "10秒の待機を始める")
        open.tap()
        XCTAssertTrue(waiting.waitForExistence(timeout: 4))
        reveal(stop, in: app, scrollingUp: true)
        stop.tap()
        reveal(count, in: app, scrollingUp: true)
        XCTAssertEqual(count.label, "今日、開かずに戻れた回数、1回")
    }

    @MainActor private func captureScreens(appearance: String) {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--screenshot-demo", "--screenshot-appearance", appearance,
                               "-AppleLanguages", "(ja)", "-AppleLocale", "ja_JP"]
        app.launch()

        let permission = app.buttons["setup-permission"]
        XCTAssertTrue(element("setup-permission-purpose", in: app).waitForExistence(timeout: 8))
        capture("01-onboarding-permission", appearance, visible: permission)
        permission.tap()

        let start = app.buttons["setup-start"]
        verifyDemoSelection(start: start, in: app, accessibilitySize: false)
        capture("02-onboarding-apps", appearance, visible: start)
        start.tap()

        let count = element("home-count", in: app)
        capture("04-home", appearance, visible: count)
        XCTAssertEqual(count.label, "今日、開かずに戻れた回数、0回")

        let shield = element("home-shield", in: app)
        reveal(shield, in: app)
        shield.tap()
        let stop = app.buttons["shield-stop"]
        let open = app.buttons["shield-open"]
        XCTAssertTrue(stop.waitForExistence(timeout: 8))
        XCTAssertTrue(stop.isHittable)
        XCTAssertTrue(open.isHittable)
        XCTAssertTrue(app.frame.contains(stop.frame))
        XCTAssertTrue(app.frame.contains(open.frame))
        XCTAssertLessThanOrEqual(stop.frame.maxY, open.frame.minY)
        XCTAssertEqual(stop.label, "開かずに戻る")
        XCTAssertEqual(open.label, "10秒の待機を始める")
        capture("05-shield-preview", appearance, visible: app.staticTexts["shield-title"])
        app.navigationBars.buttons.firstMatch.tap()

        let report = element("home-report", in: app)
        reveal(report, in: app)
        report.tap()
        let summary = element("report-summary", in: app)
        capture("06-report", appearance, visible: summary)
        XCTAssertTrue(summary.label.contains("48分"))
        app.navigationBars.buttons.firstMatch.tap()

        verifyPaywall(in: app, appearance: appearance, capturePaywall: true)
    }

    @MainActor private func exerciseAccessiblePaywall(appearance: String) {
        let app = openDemoHome(appearance: appearance, accessibilitySize: true)
        verifyPaywall(in: app, appearance: appearance)
    }

    @MainActor private func openDemoHome(appearance: String, accessibilitySize: Bool) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--screenshot-demo", "--screenshot-appearance", appearance,
                               "-AppleLanguages", "(ja)", "-AppleLocale", "ja_JP"]
        if accessibilitySize { app.launchArguments.append("--screenshot-ax5") }
        app.launch()
        let permission = element("setup-permission", in: app)
        reveal(permission, in: app)
        permission.tap()
        let start = app.buttons["setup-start"]
        reveal(start, in: app)
        start.tap()
        XCTAssertTrue(element("home-count", in: app).waitForExistence(timeout: 8))
        return app
    }

    @MainActor private func openPaywall(in app: XCUIApplication) -> XCUIElement {
        let entry = app.buttons["home-paywall"]
        // The entry is the last home row; at AX5 it sits more than eight swipes down.
        for _ in 0..<20 where !(entry.exists && entry.isHittable) { app.swipeUp() }
        reveal(entry, in: app)
        entry.tap()

        let bar = app.navigationBars["ひと呼吸 Pro"]
        XCTAssertTrue(bar.waitForExistence(timeout: 8))
        let form = app.collectionViews["paywall-form"]
        XCTAssertTrue(form.waitForExistence(timeout: 8))
        return bar
    }

    /// 08 compares both prices with the entry example. 07 checks the selected terms and purchase action.
    @MainActor private func verifyPaywall(in app: XCUIApplication, appearance: String, capturePaywall: Bool = false) {
        let bar = openPaywall(in: app)
        let form = app.collectionViews["paywall-form"]
        let example = app.staticTexts["paywall-example"]
        let monthly = app.buttons["paywall-monthly"]
        let yearly = app.buttons["paywall-yearly"]
        let terms = app.staticTexts["paywall-terms"]
        let billing = element("paywall-billing", in: app)
        let demoNotice = app.staticTexts["paywall-demo"]
        let purchase = app.buttons["paywall-purchase"]
        XCTAssertTrue(example.waitForExistence(timeout: 8))
        if !capturePaywall { revealBelowBar(example, bar: bar, in: app) }
        XCTAssertTrue(example.label.contains("平日 20:00〜22:00"))
        XCTAssertTrue(example.label.contains("土日 9:00〜11:00"))
        XCTAssertFalse(app.staticTexts["paywall-progress-value"].exists)

        if capturePaywall {
            for row in [example, monthly, yearly] {
                XCTAssertTrue(isBelowBar(row, bar: bar, in: app), row.debugDescription)
            }
            XCTAssertTrue(monthly.label.contains("¥600／月"))
            XCTAssertTrue(yearly.label.contains("¥4,800／年"))
            capture("08-paywall-value", appearance, visible: yearly)
            let initialGap = monthly.frame.minY - bar.frame.maxY
            // Expand the rows below the CTA so even tall viewports have room to align the prices.
            for disclosure in [billing, element("paywall-features", in: app)] {
                revealBelowBar(disclosure, bar: bar, in: app)
                disclosure.tap()
            }
            revealBelowBar(monthly, bar: bar, in: app, scrollingUp: true)
            for _ in 0..<8 {
                let gap = monthly.frame.minY - bar.frame.maxY
                if isAlignedForTermsCapture(gap: gap, initialGap: initialGap) { break }
                dragPaywall(in: form, distance: max(-180, min(180, gap - 14)))
            }
            let finalGap = monthly.frame.minY - bar.frame.maxY
            XCTAssertTrue(isAlignedForTermsCapture(gap: finalGap, initialGap: initialGap),
                          "07 monthly row gap after scrolling: \(initialGap) → \(finalGap) pt")
            for row in [monthly, yearly, demoNotice, terms, purchase] {
                XCTAssertTrue(isBelowBar(row, bar: bar, in: app), row.debugDescription)
            }
            XCTAssertEqual(terms.label, "14日間無料。その後は ¥4,800／年で自動更新")
            XCTAssertEqual(purchase.label, "14日間無料で始める")
            capture("07-paywall", appearance, visible: terms)
            return
        }
        // Check each row while it is on screen, including at AX5.
        revealBelowBar(monthly, bar: bar, in: app)
        XCTAssertTrue(monthly.label.contains("¥600／月"))
        revealBelowBar(yearly, bar: bar, in: app)
        XCTAssertTrue(yearly.label.contains("¥4,800／年"))
        XCTAssertTrue(yearly.label.contains("14日間無料"))
        XCTAssertEqual(yearly.value as? String, "選択中")
        revealBelowBar(demoNotice, bar: bar, in: app)
        XCTAssertTrue(demoNotice.label.contains("デモ表示"))
        revealBelowBar(terms, bar: bar, in: app)
        XCTAssertEqual(terms.label, "14日間無料。その後は ¥4,800／年で自動更新")
        revealBelowBar(purchase, bar: bar, in: app)
        XCTAssertEqual(purchase.label, "14日間無料で始める")
        XCTAssertTrue(purchase.isEnabled)
        revealBelowBar(monthly, bar: bar, in: app, scrollingUp: true)
        monthly.tap()
        XCTAssertEqual(monthly.value as? String, "選択中")
        revealBelowBar(terms, bar: bar, in: app)
        XCTAssertEqual(terms.label, "¥600／月で自動更新")
        revealBelowBar(purchase, bar: bar, in: app)
        XCTAssertEqual(purchase.label, "購入する")
        revealBelowBar(billing, bar: bar, in: app)
        billing.tap()
        let details = app.staticTexts["paywall-billing-details"]
        revealBelowBar(details, bar: bar, in: app, target: .beginning)
        XCTAssertTrue(details.label.contains("24時間前まで"))
        XCTAssertTrue(details.label.contains("Apple Account"))
        revealBelowBar(details, bar: bar, in: app, target: .end)
        XCTAssertTrue(details.label.hasSuffix("解約は端末のサブスクリプション設定から行えます。"))
        revealBelowBar(app.buttons["paywall-restore"], bar: bar, in: app)
    }

    private func paywallViewport(form: CGRect, barBottom: CGFloat) -> CGRect {
        let top = max(form.minY, barBottom)
        return CGRect(x: form.minX, y: top, width: form.width, height: max(0, form.maxY - top))
    }

    private func fullyVisible(_ row: CGRect, in viewport: CGRect) -> Bool {
        !row.isEmpty && viewport.contains(row)
    }

    private enum PaywallRowTarget { case whole, beginning, end }

    private func paywallRevealFrame(_ row: CGRect, in viewport: CGRect, target: PaywallRowTarget) -> CGRect {
        guard row.height > viewport.height else { return row }
        switch target {
        case .whole: return row
        case .beginning: return CGRect(x: row.minX, y: row.minY, width: row.width, height: 1)
        case .end: return CGRect(x: row.minX, y: row.maxY - 1, width: row.width, height: 1)
        }
    }

    private func isPaywallTargetVisible(_ row: CGRect, in viewport: CGRect, target: PaywallRowTarget) -> Bool {
        fullyVisible(paywallRevealFrame(row, in: viewport, target: target), in: viewport)
    }

    private func paywallScrollDistance(for target: CGRect, in viewport: CGRect) -> CGFloat {
        if target.minY < viewport.minY { return target.minY - viewport.minY - 12 }
        if target.maxY > viewport.maxY { return target.maxY - viewport.maxY + 12 }
        return 0
    }

    private func isAlignedForTermsCapture(gap: CGFloat, initialGap: CGFloat) -> Bool {
        (4...26).contains(gap) && initialGap - gap >= 24
    }

    @MainActor private func isBelowBar(_ row: XCUIElement, bar: XCUIElement, in app: XCUIApplication) -> Bool {
        let form = app.collectionViews["paywall-form"]
        guard form.exists, row.exists else { return false }
        let viewport = paywallViewport(form: form.frame.intersection(app.frame), barBottom: bar.frame.maxY)
        return fullyVisible(row.frame, in: viewport) && row.isHittable
    }

    @MainActor private func revealBelowBar(_ row: XCUIElement, bar: XCUIElement, in app: XCUIApplication,
                                          scrollingUp: Bool = false, target: PaywallRowTarget = .whole) {
        let form = app.collectionViews["paywall-form"]
        XCTAssertTrue(form.exists)
        let viewport = paywallViewport(form: form.frame.intersection(app.frame), barBottom: bar.frame.maxY)
        guard !viewport.isEmpty else {
            XCTFail("Paywall form has no viewport below the navigation bar")
            return
        }
        let limit = min(240, viewport.height * 0.4)
        for _ in 0..<30 {
            var distance: CGFloat = scrollingUp ? -240 : 240
            if row.exists {
                let frame = row.frame
                if !frame.isEmpty {
                    let required = paywallRevealFrame(frame, in: viewport, target: target)
                    if isPaywallTargetVisible(frame, in: viewport, target: target) {
                        if required != frame || row.isHittable { return }
                    } else {
                        let adjustment = paywallScrollDistance(for: required, in: viewport)
                        if adjustment != 0 { distance = adjustment }
                    }
                }
            }
            dragPaywall(in: form, distance: max(-limit, min(limit, distance)))
        }
        XCTFail("Could not reveal \(target) of \(row.debugDescription)")
    }

    /// Scrolls the paywall form by roughly `distance` points; positive moves content up.
    @MainActor private func dragPaywall(in form: XCUIElement, distance: CGFloat) {
        let start = form.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -distance)),
                    withVelocity: .slow, thenHoldForDuration: 0.25)
    }

    /// The demo picker shows candidates with their state and count, and cannot start with nothing chosen.
    @MainActor private func verifyDemoSelection(start: XCUIElement, in app: XCUIApplication, accessibilitySize: Bool) {
        let row = app.buttons["setup-demo-app-video"]
        let count = app.staticTexts["setup-selection-count"]
        XCTAssertTrue(row.waitForExistence(timeout: 8))
        XCTAssertTrue(row.isHittable)
        XCTAssertTrue(app.frame.contains(row.frame))
        XCTAssertTrue(count.isHittable)
        XCTAssertLessThanOrEqual(row.frame.maxY, count.frame.minY)
        XCTAssertEqual(row.value as? String, "選択済み")
        XCTAssertEqual(count.label, "選択済み 1件")
        XCTAssertTrue(start.isEnabled)
        row.tap()
        XCTAssertEqual(row.value as? String, "未選択")
        XCTAssertEqual(count.label, "選択済み 0件")
        XCTAssertFalse(start.isEnabled)
        row.tap()
        XCTAssertEqual(count.label, "選択済み 1件")
        XCTAssertTrue(start.isEnabled)
        let terms = element("setup-first-run-terms", in: app)
        let footer = app.scrollViews["setup-picker-actions-scroll"]
        if accessibilitySize, footer.exists {
            reveal(terms, in: footer)
        }
        XCTAssertTrue(terms.isHittable)
        XCTAssertTrue((footer.exists ? footer.frame : app.frame).contains(terms.frame))
        XCTAssertTrue(terms.label.contains("今回：今から1時間（21:00まで）"))
        XCTAssertTrue(terms.label.contains("繰り返し：明日から毎日 20:00〜21:00"))
        if accessibilitySize, footer.exists {
            reveal(start, in: footer)
        }
        XCTAssertTrue(start.isHittable)
        XCTAssertTrue((footer.exists ? footer.frame : app.frame).contains(start.frame))
        XCTAssertTrue(row.isHittable)
        XCTAssertLessThanOrEqual(row.frame.maxY, start.frame.minY)
    }

    @MainActor private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    @MainActor private func reveal(_ element: XCUIElement, in scrollArea: XCUIElement, scrollingUp: Bool = false) {
        _ = element.waitForExistence(timeout: 2)
        if element.exists && element.isHittable { return }
        for _ in 0..<8 {
            if scrollingUp { scrollArea.swipeDown() }
            else { scrollArea.swipeUp() }
            _ = element.waitForExistence(timeout: 2)
            if element.exists && element.isHittable { return }
        }
        XCTFail("Could not reveal \(element)")
    }

    @MainActor private func capture(_ name: String, _ appearance: String, visible element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 8), name)
        XCTAssertTrue(element.isHittable, name)
        let attachment = XCTAttachment(
            data: XCUIScreen.main.screenshot().pngRepresentation,
            uniformTypeIdentifier: "public.png"
        )
        attachment.name = "\(appearance)-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
