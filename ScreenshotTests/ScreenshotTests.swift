import XCTest

final class ScreenshotTests: XCTestCase {
    @MainActor func testLightScreens() {
        captureScreens(appearance: "light")
    }

    @MainActor func testDarkScreens() {
        captureScreens(appearance: "dark")
    }

    @MainActor func testFirstBlockDemo() {
        exerciseFirstBlockDemo(extraArguments: [], measure: true)
    }

    @MainActor func testFirstBlockDemoAtAX5() {
        exerciseFirstBlockDemo(extraArguments: ["--screenshot-ax5"], measure: false)
    }

    @MainActor private func exerciseFirstBlockDemo(extraArguments: [String], measure: Bool) {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--screenshot-demo"] + extraArguments
        app.launch()

        let clock = ContinuousClock()
        let started = clock.now
        var taps = 0
        for identifier in ["setup-permission", "setup-start", "home-shield"] {
            let control = element(identifier, in: app)
            XCTAssertTrue(control.waitForExistence(timeout: 8), identifier)
            reveal(control, in: app)
            control.tap()
            taps += 1
        }
        XCTAssertTrue(app.staticTexts["shield-title"].waitForExistence(timeout: 8))
        let elapsed = started.duration(to: clock.now)
        if measure {
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
        XCTAssertTrue(count.waitForExistence(timeout: 8))
        XCTAssertEqual(count.label, "今日、開かずに戻れた回数、1回")
    }

    @MainActor private func captureScreens(appearance: String) {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["--screenshot-demo", "--screenshot-appearance", appearance,
                               "-AppleLanguages", "(ja)", "-AppleLocale", "ja_JP"]
        app.launch()

        let permission = app.buttons["setup-permission"]
        capture("01-onboarding-permission", appearance, visible: permission)
        permission.tap()

        let start = app.buttons["setup-start"]
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

    @MainActor private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    @MainActor private func reveal(_ element: XCUIElement, in app: XCUIApplication, scrollingUp: Bool = false) {
        for _ in 0..<4 {
            if element.isHittable { return }
            if scrollingUp { app.swipeDown() }
            else { app.swipeUp() }
        }
        XCTAssertTrue(element.isHittable)
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
