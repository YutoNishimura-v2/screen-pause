失敗 b8c5ffc711a0f04c9bafbaed3a459ceac9cdff61

- 実行URL: https://github.com/YutoNishimura-v2/screen-pause/actions/runs/46152326791
- 失敗したステップ: iPhone シミュレータで撮影
- コミット: b8c5ffc711a0f04c9bafbaed3a459ceac9cdff61

## エラー行

```text
[02-screenshots.txt:4490] /Users/runner/work/screen-pause/screen-pause/ScreenshotTests/ScreenshotTests.swift:475: error: -[ScreenshotTests.ScreenshotTests testPaywallAtAX5Dark] : failed - Could not reveal beginning of Query chain:
[02-screenshots.txt:5099] /Users/runner/work/screen-pause/screen-pause/ScreenshotTests/ScreenshotTests.swift:475: error: -[ScreenshotTests.ScreenshotTests testPaywallAtAX5Light] : failed - Could not reveal beginning of Query chain:
[02-screenshots.txt:5650] ** TEST FAILED **
```

## ステップ別ログ（末尾150行）

### 01-xcodegen（全10行中 末尾10行）

全文: [01-xcodegen.txt](01-xcodegen.txt)

```text
[32m==>[0m [1mDownloading bottle manifests[0m
✔︎ Bottle Manifest xcodegen (2.48.0)
[32m==>[0m [1mFetching downloads for: [32mxcodegen[39m[0m
✔︎ Bottle xcodegen (2.48.0)
[34m==>[0m [1mPouring xcodegen--2.48.0.arm64_tahoe.bottle.tar.gz[0m
🍺  /opt/homebrew/Cellar/xcodegen/2.48.0: 38 files, 9.8MB
⚙️  Generating plists...
⚙️  Generating project...
⚙️  Writing project...
Created project at /Users/runner/work/screen-pause/screen-pause/ScreenPause.xcodeproj
```

### 02-screenshots（全5652行中 末尾150行）

全文: [02-screenshots.txt](02-screenshots.txt)

```text
    t =    12.02s     Find the "home-paywall" Button
    t =    12.05s     Check for interrupting elements affecting "home-paywall" Button
    t =    12.08s     Synthesize event
    t =    12.37s     Wait for jp.screenpause.app to idle
    t =    13.06s Waiting 8.0s for "ひと呼吸 Pro" NavigationBar to exist
    t =    14.08s     Checking `Expect predicate `existsNoRetry == 1` for object "ひと呼吸 Pro" NavigationBar`
    t =    14.08s         Checking existence of `"ひと呼吸 Pro" NavigationBar`
    t =    14.17s Waiting 8.0s for "paywall-form" CollectionView to exist
    t =    15.26s     Checking `Expect predicate `existsNoRetry == 1` for object "paywall-form" CollectionView`
    t =    15.26s         Checking existence of `"paywall-form" CollectionView`
    t =    15.33s Checking existence of `"paywall-form" CollectionView`
    t =    15.38s Find the "paywall-form" CollectionView
    t =    15.44s Find the Target Application 'jp.screenpause.app'
    t =    15.48s Find the "ひと呼吸 Pro" NavigationBar
    t =    15.54s Checking existence of `"paywall-restore" Button`
    t =    15.60s Find the "paywall-restore" Button
    t =    15.66s Press "paywall-form" CollectionView[0.50, 0.55] for 0.1 seconds, then drag to "paywall-form" CollectionView[0.50, 0.55] -> (0.0, -20.3) with velocity of 250.00 pixels per second, and then hold for 0.2 seconds 
    t =    15.66s     Wait for jp.screenpause.app to idle
    t =    15.66s     Find the "paywall-form" CollectionView
    t =    15.72s     Check for interrupting elements affecting "paywall-form" CollectionView
    t =    15.78s     Synthesize event
    t =    15.78s         Find the "paywall-form" CollectionView
    t =    15.84s         Find the "paywall-form" CollectionView
    t =    15.90s         Find the "paywall-form" CollectionView
    t =    15.96s         Find the "paywall-form" CollectionView
    t =    16.02s         Find the "paywall-form" CollectionView
    t =    16.72s     Wait for jp.screenpause.app to idle
    t =    16.73s Checking existence of `"paywall-restore" Button`
    t =    16.79s Find the "paywall-restore" Button
    t =    16.86s Find the "paywall-restore" Button
    t =    16.94s Find the "paywall-restore" Button
    t =    17.00s Tap "paywall-restore" Button
    t =    17.00s     Wait for jp.screenpause.app to idle
    t =    17.01s     Find the "paywall-restore" Button
    t =    17.07s     Check for interrupting elements affecting "paywall-restore" Button
    t =    17.13s     Synthesize event
    t =    17.43s     Wait for jp.screenpause.app to idle
    t =    17.69s Checking existence of `"paywall-form" CollectionView`
    t =    17.76s Find the "paywall-form" CollectionView
    t =    17.82s Find the Target Application 'jp.screenpause.app'
    t =    17.87s Find the "ひと呼吸 Pro" NavigationBar
    t =    17.93s Checking existence of `"paywall-restore-message" StaticText`
    t =    17.99s Find the "paywall-restore-message" StaticText
    t =    18.06s Press "paywall-form" CollectionView[0.50, 0.55] for 0.1 seconds, then drag to "paywall-form" CollectionView[0.50, 0.55] -> (0.0, -62.3) with velocity of 250.00 pixels per second, and then hold for 0.2 seconds 
    t =    18.06s     Wait for jp.screenpause.app to idle
    t =    18.06s     Find the "paywall-form" CollectionView
    t =    18.12s     Check for interrupting elements affecting "paywall-form" CollectionView
    t =    18.17s     Synthesize event
    t =    18.18s         Find the "paywall-form" CollectionView
    t =    18.24s         Find the "paywall-form" CollectionView
    t =    18.30s         Find the "paywall-form" CollectionView
    t =    18.36s         Find the "paywall-form" CollectionView
    t =    18.43s         Find the "paywall-form" CollectionView
    t =    19.28s     Wait for jp.screenpause.app to idle
    t =    19.61s Checking existence of `"paywall-restore-message" StaticText`
    t =    19.68s Find the "paywall-restore-message" StaticText
    t =    19.75s Find the "paywall-restore-message" StaticText
    t =    19.82s Find the "paywall-restore-message" StaticText
    t =    19.88s Checking existence of `"paywall-form" CollectionView`
    t =    19.94s Find the "paywall-form" CollectionView
    t =    20.00s Find the Target Application 'jp.screenpause.app'
    t =    20.04s Find the "ひと呼吸 Pro" NavigationBar
    t =    20.11s Checking existence of `"paywall-monthly" Button`
    t =    20.16s Find the "paywall-monthly" Button
    t =    20.23s Find the "paywall-monthly" Button
    t =    20.30s Tap "paywall-monthly" Button
    t =    20.30s     Wait for jp.screenpause.app to idle
    t =    20.35s     Find the "paywall-monthly" Button
    t =    20.41s     Check for interrupting elements affecting "paywall-monthly" Button
    t =    20.47s     Synthesize event
    t =    20.77s     Wait for jp.screenpause.app to idle
    t =    20.77s Checking existence of `"paywall-form" CollectionView`
    t =    20.84s Find the "paywall-form" CollectionView
    t =    20.92s Find the Target Application 'jp.screenpause.app'
    t =    20.97s Find the "ひと呼吸 Pro" NavigationBar
    t =    21.05s Checking existence of `"paywall-purchase" Button`
    t =    21.11s Find the "paywall-purchase" Button
    t =    21.18s Find the "paywall-purchase" Button
    t =    21.25s Tap "paywall-purchase" Button
    t =    21.25s     Wait for jp.screenpause.app to idle
    t =    21.26s     Find the "paywall-purchase" Button
    t =    21.32s     Check for interrupting elements affecting "paywall-purchase" Button
    t =    21.39s     Synthesize event
    t =    21.68s     Wait for jp.screenpause.app to idle
    t =    21.68s Checking existence of `"paywall-form" CollectionView`
    t =    21.74s Find the "paywall-form" CollectionView
    t =    21.81s Find the Target Application 'jp.screenpause.app'
    t =    21.87s Find the "ひと呼吸 Pro" NavigationBar
    t =    21.93s Checking existence of `"paywall-message" StaticText`
    t =    21.99s Find the "paywall-message" StaticText
    t =    22.06s Find the "paywall-message" StaticText
    t =    22.14s Find the "paywall-message" StaticText
    t =    22.20s Checking existence of `"paywall-form" CollectionView`
    t =    22.26s Find the "paywall-form" CollectionView
    t =    22.32s Find the Target Application 'jp.screenpause.app'
    t =    22.38s Find the "ひと呼吸 Pro" NavigationBar
    t =    22.45s Checking existence of `"利用規約" Any`
    t =    22.85s Find the "利用規約" Any
    t =    23.24s Press "paywall-form" CollectionView[0.50, 0.55] for 0.1 seconds, then drag to "paywall-form" CollectionView[0.50, 0.55] -> (0.0, -62.3) with velocity of 250.00 pixels per second, and then hold for 0.2 seconds 
    t =    23.24s     Wait for jp.screenpause.app to idle
    t =    23.25s     Find the "paywall-form" CollectionView
    t =    23.31s     Check for interrupting elements affecting "paywall-form" CollectionView
    t =    23.37s     Synthesize event
    t =    23.37s         Find the "paywall-form" CollectionView
    t =    23.43s         Find the "paywall-form" CollectionView
    t =    23.49s         Find the "paywall-form" CollectionView
    t =    23.55s         Find the "paywall-form" CollectionView
    t =    23.62s         Find the "paywall-form" CollectionView
    t =    24.47s     Wait for jp.screenpause.app to idle
    t =    24.47s Checking existence of `"利用規約" Button`
    t =    24.89s Find the "利用規約" Button
    t =    25.36s Find the "利用規約" Button
    t =    25.82s Checking existence of `"paywall-restore-message" StaticText`
    t =    25.88s Tear Down
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallDemoRestoreThenPlanChangeThenPurchase]' passed (26.094 seconds).
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallRejectsPartialTermsInFormViewport]' started.
    t =     0.00s Start Test at 2026-11-28 14:12:33.330
    t =     0.02s Set Up
    t =     0.02s Tear Down
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallRejectsPartialTermsInFormViewport]' passed (0.079 seconds).
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallRevealsOversizedBillingDetailsFromBeginningToEnd]' started.
    t =     0.00s Start Test at 2026-11-28 14:12:33.409
    t =     0.02s Set Up
    t =     0.03s Tear Down
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallRevealsOversizedBillingDetailsFromBeginningToEnd]' passed (0.080 seconds).
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallScrollsForCaptureEvenWhenPurchaseFitsInitially]' started.
    t =     0.00s Start Test at 2026-11-28 14:12:33.490
    t =     0.02s Set Up
    t =     0.03s Tear Down
Test Case '-[ScreenshotTests.ScreenshotTests testPaywallScrollsForCaptureEvenWhenPurchaseFitsInitially]' passed (0.078 seconds).
Test Suite 'ScreenshotTests' failed at 2026-11-28 14:12:33.568.
	 Executed 15 tests, with 2 failures (0 unexpected) in 628.019 (628.028) seconds
Test Suite 'ScreenshotTests.xctest' failed at 2026-11-28 14:12:33.569.
	 Executed 15 tests, with 2 failures (0 unexpected) in 628.019 (628.028) seconds
Test Suite 'All tests' failed at 2026-11-28 14:12:33.569.
	 Executed 15 tests, with 2 failures (0 unexpected) in 628.019 (628.029) seconds
2026-11-28 14:12:47.188 xcodebuild[12128:38642] [MT] IDETestOperationsObserverDebug: 655.654 elapsed -- Testing started completed.
2026-11-28 14:12:47.189 xcodebuild[12128:38642] [MT] IDETestOperationsObserverDebug: 0.000 sec, +0.000 sec -- start
2026-11-28 14:12:47.189 xcodebuild[12128:38642] [MT] IDETestOperationsObserverDebug: 655.654 sec, +655.654 sec -- end

Test session results, code coverage, and logs:
	/Users/runner/work/_temp/screenshots.xcresult

Failing tests:
	ScreenshotTests.testPaywallAtAX5Dark()
	ScreenshotTests.testPaywallAtAX5Light()

** TEST FAILED **

Testing started
```
