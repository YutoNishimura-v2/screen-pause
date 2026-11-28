import XCTest

final class ScreenshotTests: XCTestCase {
    @MainActor func testLightScreens() {
        captureScreens(appearance: "light")
    }

    @MainActor func testDarkScreens() {
        captureScreens(appearance: "dark")
    }

    @MainActor func testFirstBlockDemo() {
        exerciseFirstBlockDemo(appearance: "light", accessibilitySize: false)
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
        XCTAssertEqual(open.label, "10秒待って開く")
        open.tap()
        XCTAssertTrue(open.exists)
        reveal(stop, in: app, scrollingUp: true)
        stop.tap()
        let count = element("home-count", in: app)
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
        capture("05-shield-preview", appearance, visible: app.staticTexts["shield-title"])
        app.navigationBars.buttons.firstMatch.tap()

        let report = element("home-report", in: app)
        reveal(report, in: app)
        report.tap()
        let summary = element("report-summary", in: app)
        capture("06-report", appearance, visible: summary)
        XCTAssertTrue(summary.label.contains("48分"))
        app.navigationBars.buttons.firstMatch.tap()

        let paywall = app.buttons["home-paywall"]
        reveal(paywall, in: app)
        paywall.tap()
        capture("08-paywall-value", appearance, visible: app.staticTexts["paywall-progress-value"])
        let terms = app.staticTexts["paywall-terms"]
        reveal(terms, in: app)
        capture("07-paywall", appearance, visible: terms)
        XCTAssertTrue(terms.label.contains("14日間無料"))
        XCTAssertTrue(terms.label.contains("¥4,800／年"))
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
