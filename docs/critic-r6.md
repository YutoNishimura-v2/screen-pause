# 独立批評 Round 6（国内最上位制限アプリパターンとの販売力比較）

**総合スコア: 6.3 / 10（7軸合計 44 / 70、Round 5 比 +4点）** — **Paywall の価値訴求と無料レポートの即時性は前進したが、ホームの雑多さと初週〜Store 公開の詰めの甘さで参考パターン並みにはまだ届かない。**

> [!NOTE]
> - **基盤コミット確認**: `HEAD`（`2c1b4d5`, `land/main`）は Round 5 修正コミット `6f683412` と同一著者・同一日時（`Fri Nov 27 05:48:08 2026 +0900`）・同一ツリー（`07d2021030efba095dbef17b756e4d67bfd41234`, `git diff 6f683412 HEAD` 差分なし）であることを確認済み。
> - **検証範囲の制約**: GitHub Actions の承認待ちのため CI 実撮影スクリーンショットはまだ存在しない。本批評は SwiftUI ソース、デモデータ（`ReportsView.sample`・`ScreenPause.storekit`・`SetupView(demo: true)`）、App Store メタデータに基づく。実機未確認の視覚配置・コントラスト・AX5 折り返し・OS 拡張の挙動判断にはすべて **`推測`** を付記した。競合名・競合画像・競合のストア数値はリポジトリ方針に従い記載しない。

---

## 7軸スコアリング（Round 5 比較・シーン別照合）

| # | 評価軸 | r5 | r6 | 参考パターンとの比較・根拠 |
| --- | --- | ---: | ---: | --- |
| 1 | 初回1分（導入〜最初のブロック・タップ数） | 7 / 10 | **7 / 10** | Round 5 から変化なし。デモ3タップ（`ScreenshotTests/ScreenshotTests.swift:29-35`）・実機5〜7タップで開始できるが、`immediateSchedule` が導入時の分刻みを毎日の定期予定に固定し（`App/ScreenPauseApp.swift:610-614, 647`）、初日試行案内も脚注1行のまま（`:374-376`、`推測`）。 |
| 2 | ホームの明快さ（主指標1つ・不要情報排除） | 5 / 10 | **5 / 10** | 参考パターンはホーム最上部に「削れた時間または残り時間」の数値1つと明確な制限状態を置く。本アプリは `homeForm` に4〜5セクション・十数行が縦積みされ（`App/ScreenPauseApp.swift:343-495`）、制限状態も `Text("制限中")`（`:401`）だけで残り時間がなく、対象アプリ変更も `scheduleForm` の奥に埋もれている（`:316`、見た目 `推測`）。 |
| 3 | メイン画面（制限・待機体験） | 6 / 10 | **6 / 10** | 段階的待機の上限を300秒、設定範囲を0〜60秒へ拡大（`Shared/Domain.swift:108, 170`）。一方 Round 5 #4 は未着手で、OS シールド待機中に解除可能時刻・5分間の一時解除説明・押下後の副ボタン切り替えが無く（`Shield/Shield.swift:30-31, 48-50`）、ホーム上の案内も「もう一度押すと開けます。」（`Shared/ShieldAppearance.swift:34`）のまま誤解を招く。 |
| 4 | 購入画面（Paywall・価格・試用・移行） | 5 / 10 | **7 / 10** | 厳格モードを Pro 化し（`Shared/Domain.swift:28`）、価値訴求5行を購入ボタン上へ移動、年額行に「14日間無料」「月額比 約31%お得」を表示し、`store.revision == 0` の無言無効化も解除（`App/Paywall.swift:32-63`, `App/ScreenPauseApp.swift:415-486`）。ただし更新前の無料ユーザーの厳格モードが黙って無効化され、デモ仮価格の注記が下部スクロール時に画面外へ外れる（`推測`）。 |
| 5 | 2〜7日目の継続（定着・レポート） | 5 / 10 | **6 / 10** | `.hourly` 集計と2日目比較 `earlyDelta`・上位5アプリ・時間帯別利用を追加（`Report/UsageReport.swift:20-79`, `Shared/UsageReportView.swift:29-58`）。しかし最大約42日分の `.hourly` を iOS が返すか未検証（`推測`）で `今週へらせた時間` が `記録待ち` になる恐れがあり、`earlyDelta` は「今日の途中経過 − 昨日24時間」の非対称比較、`ReportsView.sample` も `apps: [], hourly: []` で空（`App/ReportsView.swift:58-59`）。 |
| 6 | Store 公開準備（掲載文・画像・アイコン・規約） | 5 / 10 | **6 / 10** | 検索語55文字/99バイト拡充・説明文への段階延長/カレンダー追記・審査メモ手順7〜8および `PauseReport` 非送信説明を反映（`docs/app-store/metadata.ja.json:4-5`, `docs/app-store/review-notes.ja.md:7-20`）。一方、参考パターンが Store 画像に実績数字とキャッチを載せるのに対し、本アプリは `AppIcon` 未設定（`project.yml:28-38`）、Store 画像未撮影・見出し無し、`docs/legal/terms.md:12` 未更新が残る。 |
| 7 | アクセシビリティ（Dynamic Type・VO・配色） | 7 / 10 | **7 / 10** | Round 5 #7 が未着手で変化なし。`MonthCalendarView` の固定9pt チェック（`App/ReportsView.swift:181`）・空白36pt 固定高（`:153`）・枠線のみの `missed`（`:192`）は AX5 や低コントラスト環境で窮屈/識別困難になりやすい（`推測`）。AX5 UI テスト（`ScreenshotTests/ScreenshotTests.swift:16-18`）もレポート・Paywall を対象外にしている。 |
| **合計** | **7軸合計（平均）** | **40 / 70 (5.7)** | **44 / 70 (6.3)** | Round 5 の3件反映で Paywall・2〜7日目・Store が改善したが、ホーム整理・シールド UX・実機/アイコン準備が未完了。 |

---

## 既知事項（Round 5 引き継ぎ）と価格「仮」表記の点検

### Round 5 引き継ぎ4項目の判定
| # | 引き継ぎ事項 | 判定 | 理由・参照 |
| --- | --- | --- | --- |
| (1) | 無料ユーザーが有効にしていた厳格モードが更新後に無通知で失われる | **ギャップ（4位）** | `Shared/ScreenTime.swift:80-84` が `PaywallReason.strictMode.isAvailable` で即座に `false` を返し、`App/ScreenPauseApp.swift:438-440` が鍵付きボタンに差し替えるだけで移行通知を出さない。 |
| (2) | `.hourly` DeviceActivityReport（最大約42日）を iOS が返すか未検証で `今週へらせた時間` が `記録待ち` になる恐れ | **ギャップ（2位）** | `Shared/UsagePeriods.swift:24, 47` と `App/ReportsView.swift:37-45` の組み合わせは最大約42日分の `.hourly` 返却を前提とするが実機未検証（`推測`）。欠落時は `savedTime` が `nil` になる。 |
| (3) | Fix 3 未完（`AppIcon` 所有者選定待ち、Store スクショ要 Xcode） | **ギャップ（3位）** | `project.yml:28-38` にアイコン設定がなく、`ScreenshotTests/ScreenshotTests.swift:61-103` の撮影もワークフロー未承認で未実施。 |
| (4) | Round 5 変更が12ファイルに跨ったこと | **ギャップではない** | 変更規模自体は製品上の欠陥ではないためギャップに数えない。ただし同変更に伴う周辺同期漏れ（`docs/legal/terms.md:12` の Pro 説明未更新、`ReportsView.sample` 空配列）は3位・2位に含めた。 |

### 価格の「仮」表記点検（StoreKit / Paywall デモ / メタデータ）
- `docs/release-checklist.md:24-30` と `README.md:25` は仮価格であることを明記している。
- `App/Paywall.swift:30` は最上部に `Text("デモ価格（仮の値）")` を置くが、`¥580／月`・`¥4,800／年`・`¥7,800`（`:149-151`）、`31%`（`:132`）、`purchaseTerms`（`:161`）自体には「仮」の文字がない。`ScreenshotTests/ScreenshotTests.swift:98-100` の `07-paywall` のように下部 `paywall-terms` へスクロールすると最上部の注記が画面外へ外れ、価格単体では仮と分からない（`推測`）。
- `ScreenPause.storekit:10, 13, 40, 44, 62, 66` は開発者向け名前に `（仮の値）` とあるが、実際に提示される価格値（`:6, 34, 51` の `7800` / `580` / `4800`）は iOS の StoreKit テストシート上では通常の円表記になり「仮」が出ない。
- `docs/app-store/metadata.ja.json:5` は円額を書かず「価格は購入画面に表示されます。」としている一方、「対象の方には年額の14日間無料体験が表示されます。」と無料体験の提供自体は確定文言で記載している（オーナーによるオファー確定前の場合は `release-checklist.md:38` での照合が必要）。

---

## 参考パターンに対するギャップ（全7件・販売インパクト上位3位をランク付け）

### 【1位・販売インパクト最大】ホーム画面の情報過多・主指標の埋没と「残り時間／対象アプリ変更」導線の欠落
- **シーン**: ホーム（メイン画面入口）
- **対象**: `App/ScreenPauseApp.swift:316`, `App/ScreenPauseApp.swift:330-495`, `App/ScreenPauseApp.swift:367-410`
- **参考パターンとの差**:
  参考パターンはホーム最上部に「削れた時間または残り時間」の主数値1つと明確な制限状態を提示し、一目で価値が伝わる。本アプリは `homeForm` の `Form` 内に4〜5セクション・十数行（回数、待機、次の制限＋予定一覧＋追加、厳格モード＋集中時間＋開始、レポート＋履歴＋カスタム待機）を詰め込んで設定一覧のように見える（`推測`）。主カード（`:367-395`）に別話題の「利用時間は〜」注意書き（`:383-386`）が混在し、制限中の状態表示は `Text("制限中")`（`:401`）のみで「あと何分で終わるか」が読めない。また最も変更頻度の高い対象アプリ選択が `scheduleForm` の中（`:316`）に隠れており、2階層潜る必要がある。
- **機械判定できる合格条件（Node ソース検査）**:
  - `App/ScreenPauseApp.swift` の `homeForm` 内の `Section` 数が3以下であること。
  - `homeForm` の先頭カードに `snapshot.baselineStart` の案内文を含めず、制限中表示が終了時刻または残り時間を含むこと。
  - `homeForm` から `scheduleForm` を経由せず直接 `openPicker` を呼ぶボタンが存在し、予定一覧・待ち時間編集・`LegalLinks()` が `navigationTitle("設定")` 配下へ整理されていること。

### 【2位】2〜7日目レポートの不確実性（42日 `.hourly` 依存・非対称比較・デモ空データ）
- **シーン**: 2〜7日目の継続・利用時間レポート
- **対象**: `App/ReportsView.swift:37-48`, `App/ReportsView.swift:51-60`, `Shared/UsagePeriods.swift:21-27, 42-57`, `Report/UsageReport.swift:25-79`, `Shared/UsageReportView.swift:32-40`
- **参考パターンとの差**:
  参考パターンは初週から時間帯別の利用と削減成果を安定して返し、課金・継続の根拠を作る。本アプリは Round 5 で `.hourly` に統一し、`comparisonStart` により最大約42日分（35日＋今週最大7日、`Shared/UsagePeriods.swift:24`）を `.hourly` で取得する設計になったが、**iOS の `DeviceActivityReport` が約42日前の時間別セグメントをすべて返すかは実機未検証（`推測`）**。古い日の時間別データが返らない場合、`baselineDays.allSatisfy({ daily[$0] != nil })`（`Shared/UsagePeriods.swift:47`）が失敗し続け、`今週へらせた時間` が永続的に出ない恐れがある。また `earlyDelta`（`Report/UsageReport.swift:73-79`）は**今日の途中経過から昨日の24時間合計を引く**ため、日中は常に「大幅減少」と誤解させる値が出やすい。さらにデモ用の `ReportsView.sample`（`App/ReportsView.swift:58-59`）は `earlyDelta: nil, apps: [], hourly: []` のままで、新設した上位アプリ・時間帯別表示をデモも CI スクショも一切検証できない。
- **機械判定できる合格条件（Node 純粋関数テスト＋ソース検査）**:
  - `Shared/UsagePeriods.swift` に「初週日次合計が取得できない場合でも現在時刻までの同時間帯比較（`0...currentHour`）または日次補完」を行う純粋関数を追加し、部分返却データでも比較値が `nil` 固定にならないことを Node 純粋関数テストで検証すること（42日保持自体は実機確認が必要）。
  - `Report/UsageReport.swift` の `earlyDelta` が現在時刻までの同時間帯比較（または完了した昨日と一昨日の比較）に改められ、`App/ReportsView.swift` の `sample` に非空の `apps` と `hourly` が設定されていること。

### 【3位】AppIcon 未設定・Store 画像の実績数値／キャプション欠如・規約同期漏れ
- **シーン**: Store 公開準備（App Store 製品ページ・審査提出）
- **対象**: `project.yml:28-38`, `docs/icon/candidates.md:1-11`, `ScreenshotTests/ScreenshotTests.swift:61-103`, `.github/workflows/screenshots.yml:85-93`, `docs/legal/terms.md:12`
- **参考パターンとの差**:
  参考パターンは Store 画像に実績数字や効果の大きな見出しを載せて DL を獲得する。本アプリは **(a)** `App/Assets.xcassets/AppIcon.appiconset` が未生成で `project.yml:28-38` に `ASSETCATALOG_COMPILER_APPICON_NAME` が未設定（`candidates/{a,b,c}.svg` の所有者選定待ち）、**(b)** CI スクショがワークフロー承認待ちで未取得かつ `ScreenshotTests/ScreenshotTests.swift:61-103` が素の画面撮影のみで Store 用キャッチ・実績数値・段階的待機・月間カレンダーを撮っていない（`03` 欠番）、**(c)** Round 5 で Pro 化した「厳格モード」「月ごとの達成カレンダー」が `docs/legal/terms.md:12` の Pro 説明に反映されていない。
- **機械判定できる合格条件（Node ソース検査）**:
  - `project.yml` に `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` が定義され、`App/Assets.xcassets/AppIcon.appiconset/Contents.json` が存在すること。
  - `ScreenshotTests/ScreenshotTests.swift` と `.github/workflows/screenshots.yml` がカレンダー・待機画面を含み、Store 見出し定義（例: `docs/app-store/screenshots.ja.json`）が存在すること。
  - `docs/legal/terms.md` の「Proの購入」節が「厳格モード」と「月ごとの達成カレンダー」を含むこと。

### 【4位】更新前の無料ユーザーの厳格モード無通知喪失と、仮価格表示・Paywall 導線のズレ
- **シーン**: 購入画面（Paywall）・設定移行
- **対象**: `Shared/ScreenTime.swift:80-84, 241-253`, `App/ScreenPauseApp.swift:428-441`, `App/Paywall.swift:25, 30, 40, 59-62, 72-79, 132, 148-161`, `ScreenPause.storekit:6, 34, 51`
- **参考パターンとの差**:
  Round 5 で厳格モードを Pro 化した結果、更新前に無料で `strictEnabled == true` にしていた利用者は、更新後に `SharedState.isStrict`（`Shared/ScreenTime.swift:80-84`）が無言で `false` になり、`App/ScreenPauseApp.swift:438-440` でも鍵付きボタンへ変わるだけで「これまでの厳格モードが Pro 限定になり一時解除できる状態に戻った」通知が一切出ない。また `Paywall.swift:25` は `.strictMode` から開いた時も「回数の履歴〜」を先頭に出し、StoreKit ロード中はプランと購入ボタンが全て消える（`:40, 72, 79`）。加えてデモの `¥580／月`・`¥4,800／年`・`¥7,800` や `31%お得` は下部 `paywall-terms` スクロール時に最上部の `デモ価格（仮の値）`（`:30`）が画面外へ消える（`推測`）。
- **機械判定できる合格条件（Node 純粋関数テスト＋ソース検査）**:
  - `settings?.strictEnabled == true && plan == .free` のとき、移行案内フラグまたはバナー表示条件を返す純粋判定とホーム通知 UI が `Shared/ScreenTime.swift`・`App/ScreenPauseApp.swift` に存在すること。
  - `App/Paywall.swift` が `PaywallReason` に応じた導入説明を出し、デモ時 `purchaseTerms` にも仮価格である旨を含むこと。

### 【5位】OS シールド待機中の「解除可能時刻」欠如・ボタン文言固定・ホーム戻り先不明
- **シーン**: メイン画面（制限・待機体験）
- **対象**: `Shield/Shield.swift:30-31, 48-50`, `Shared/ShieldAppearance.swift:21-35`, `App/ScreenPauseApp.swift:354-362`, `App/ShieldDemoView.swift:9`
- **参考パターンとの差**:
  参考パターンは待機中に進捗と次の操作を迷わせない。本アプリの OS シールドはタイマー不可の制約があるにもかかわらず、待機中の本文が時刻無しの `"ひと呼吸。時間が過ぎたら、もう一度押せます。"`（`Shield/Shield.swift:30-31`）で、副ボタンも押下前の `"10秒待って開く"` のまま変わらず（`:48-50`）、5分間の一時解除であることも伝わらない。ホームの待機完了文言（`Shared/ShieldAppearance.swift:34`, `App/ScreenPauseApp.swift:360`）もボタンの無いホームで「もう一度押すと開けます」と表示し、対象アプリへ戻る導線が曖昧。さらに `App/ShieldDemoView.swift:9` は `PausePreferences.standard` 固定のため、段階延長やカスタム秒数の検証ができない。
- **機械判定できる合格条件（Node 純粋関数テスト＋ソース検査）**:
  - `Shared/ShieldAppearance.swift` に `unlockReadyTime` / `pendingSubtitle` 等が実装され、Node 純粋関数テストで日またぎを含む `HH:mm:ss` 生成を検証すること。
  - `Shield/Shield.swift` が `activePending` 一致時に副ボタン文言を切り替え、本文に時刻と「5分」を含め、`Shared/ShieldAppearance.swift:34`／`App/ScreenPauseApp.swift:360` が対象アプリを開くよう明記すること。

### 【6位】初回オンボーディングの「今から1時間」が毎日の定期予定として固定される問題
- **シーン**: 初回1分
- **対象**: `App/ScreenPauseApp.swift:249-250, 268, 610-614, 647`, `App/ScreenPauseApp.swift:336-338, 374-376`
- **参考パターンとの差**:
  参考パターンは「まず今すぐ試す」と「毎日の定期スケジュール」を分ける。本アプリは `immediateSchedule(at:)`（`App/ScreenPauseApp.swift:610-614`）が導入時刻の分単位そのまま（例: 14:37〜15:37）で `weekdays: Set(1...7)` の毎日予定を保存し（`:647`）、初日の試行導線も小さな `.footnote` 1行にとどまる（`:374-376`、`推測`）。
- **機械判定できる合格条件（Node 純粋関数テスト＋ソース検査）**:
  - `App/ScreenPauseApp.swift` の初回保存経路が導入分刻みの毎日 `WeeklySchedule` を作らず `focusEnd` と定期予定を分離しており、`count == 0 && blocking` 時に明瞭な初日ガイドカードを表示すること。

### 【7位】`MonthCalendarView` の AX5 対応不足・非色覚識別性・VoiceOver 統合漏れ
- **シーン**: アクセシビリティ
- **対象**: `App/ReportsView.swift:76-80, 153, 180-192`, `ScreenshotTests/ScreenshotTests.swift:16-18`
- **参考パターンとの差**:
  参考パターンは達成カレンダーを主機能として大文字でも破綻しない。本アプリは `Image(systemName: "checkmark").font(.system(size: 9, weight: .bold))`（`App/ReportsView.swift:180-181`）と空白セル固定 `height: 36`（`:153`）が残っており AX5 で文字切れ／潰れが起きやすい（`推測`）。`missed` が `Color.secondary` 1pt 枠線のみ（`:192`、`推測`）で識別性が弱く、`Section("連続日数")` の `"\(streak)日"`（`:77`）も説明文と統合されていない。`testFirstBlockDemoAtAX5`（`ScreenshotTests/ScreenshotTests.swift:16-18`）もレポート画面と Paywall を検査しない。
- **機械判定できる合格条件（Node ソース検査）**:
  - `App/ReportsView.swift` に `.system(size: 9)` と固定 `frame(height: 36)` が存在せず、`missed` 用の非色覚アイコン（`xmark` 等）と連続日数の `.accessibilityElement(children: .combine)` が存在すること。
  - `ScreenshotTests/ScreenshotTests.swift` の `--screenshot-ax5` 経路がレポート画面と Paywall の表示・操作可能性を確認すること。

---

## UI-RULES（`UI-RULES.md`）準拠点検

| ルール | 状態 | 対象 `file:line` と詳細 |
| --- | --- | --- |
| **C1**（ホームカードは「見出し＋大事な数字1つ」、説明・内訳は折りたたみ、たたまず40字まで） | **違反あり** | `App/ScreenPauseApp.swift:367-395`（主カードに「今日、開かずに戻れた回数」「0回」に加えて操作案内21字・利用時間案内25字・デモ遷移が同居し、展開時40字超かつ2話題混在）。`App/ScreenPauseApp.swift:396-426`（次の制限＋全予定一覧＋追加ボタンをホームに直接展開）。`App/ScreenPauseApp.swift:427-455`（厳格モード＋集中時間ピッカー＋開始ボタンを直接展開）。`App/ScreenPauseApp.swift:456-487`（ロック案内36字を直接展開）。関連（下層画面）: `Shared/UsageReportView.swift:44-58`（アプリ別・24時間別を `DisclosureGroup` の外に展開）、`App/ReportsView.swift:76-80`（説明文を展開表示）。 |
| **C2**（今使わない数字・案内を出さない） | **違反あり** | `App/ScreenPauseApp.swift:383-386`（ホームの回数カード内に `now < baseline` 時の利用時間未計測案内を常時表示）。 |
| **V1**（紺グラデーション・光る線・色点凡例・絵文字多用・明朝混在の禁止） | **違反なし（0件）** | SwiftUI 全ファイル（`App/`・`Shared/`・`Shield/`・`Widgets/`）を検索し、`LinearGradient`/`RadialGradient`/`AngularGradient`・光彩・色点凡例・絵文字は0件。使用色は標準アクセントの `UIColor.systemIndigo` / `.tint(.indigo)` のみ（`Shared/ShieldAppearance.swift:8`, `App/ScreenPauseApp.swift:11`）。 |
| **V2 / P1**（文字切れ0・44pt以上・Dynamic Type 対応） | **違反あり** | `App/ReportsView.swift:153`（空白セル `frame(height: 36)` 固定で44pt未満・AX5 非追従、`推測`）、`App/ReportsView.swift:181`（`.system(size: 9)` 固定で AX5 非追従、`推測`）。`App/Paywall.swift:83-87`（主購入ボタンに `.frame(minHeight: 44)` の明示なし、Form 行高依存、`推測`）。 |
| **G5 / C1**（色・枠線だけでなく形でも見分ける） | **違反あり** | `App/ReportsView.swift:188-192`（`missed` 状態が `Color.secondary` の 1pt 枠線のみで記号がなく、ライト/ダーク両方で `noSchedule` と見分けにくい、`推測`）。 |
| **P2**（取り返しにくい操作の確認） | **違反あり** | `App/ScreenPauseApp.swift:324`（`Button("この予定を削除", role: .destructive, action: removeSchedule)` に確認ダイアログがない。厳格モードオンの `:146-151` には確認あり）。 |
| **I3**（読み込み中・失敗時も空にしない） | **軽微な違反** | `App/Paywall.swift:40, 72-75, 79`（実機で StoreKit 読み込み中はプラン選択肢と購入ボタンが消え `ProgressView` のみになる、`推測`）。 |

---

## 対応

| 対象 | 状態 | 対応箇所・理由 |
| --- | --- | --- |
| **【1位】ホーム画面の整理・残り時間・直接アプリ変更** | **直した** | `App/ScreenPauseApp.swift:230-290,341-544,687-730`, `Shared/ScreenTime.swift:80-103`（`homeForm` を3セクションへ整理し `baselineStart` 案内を先頭カードから除去、制限中表示に終了時刻と残り分を追加、`homeForm` から直接 `openPicker` を呼び出して `snapshot.settings.selection` 読込・`選択を反映`・`save()` 永続化・`pickerSaveError` 表示まで接続し、予定一覧・待ち時間編集・`LegalLinks()` を `設定` 配下へ移動。あわせて削除確認ダイアログ `App/ScreenPauseApp.swift:156-159,335` を追加）。 |
| **【2位】2〜7日目レポート（部分返却補完・同時間帯比較・デモデータ）** | **直した** | `Shared/UsagePeriods.swift:60-117`, `Report/UsageReport.swift:68-83`, `Shared/UsageReportView.swift:33-60`, `App/ReportsView.swift:51-70`（`flexibleSavedTime` と `sameHourDelta` を追加して部分返却・初日同時間帯比較に対応、`apps`・`hourly` を `DisclosureGroup` に整理、`ReportsView.sample` に非空データを設定。42日分の `.hourly` 実データ返却は実機確認が必要）。 |
| **【3位】(c) 利用規約の Pro 記載同期** | **直した** | `docs/legal/terms.md:12`（Pro の説明に「月ごとの達成カレンダー」「厳格モード」を追記）。 |
| **【3位】(a)(b) AppIcon 設定・Store スクショ撮影** | **見送り** | `AppIcon` はオーナー選定待ちであり、Windows 環境に Xcode / iOS Simulator が無いためアセット登録・`ScreenshotTests` コンパイル撮影を実行できないため。 |
| **【4位】厳格モード移行通知・Paywall 導線・仮価格明示** | **直した** | `Shared/ScreenTime.swift:106-108`, `App/ScreenPauseApp.swift:414-428`, `App/Paywall.swift:25,62-189`（無料プランで `strictEnabled == true` 時の移行バナーを追加、Paywall に `reasonSummary`・仮価格表記（価格行・お得率・`purchaseTerms`）・44pt ボタン・読込中のプラン名表示を追加）。 |
| **【5位】OS シールド待機時刻・ボタン切替・ホーム戻り先** | **次回** | ホーム待機終了文言のみ対象アプリ誘導へ更新（`App/ScreenPauseApp.swift:372`）。`Shield/Shield.swift`・`Shared/ShieldAppearance.swift`・`App/ShieldDemoView.swift` は変更ファイル数上限（約10ファイル）と優先順位により次回。 |
| **【6位】初回1時間制限と毎日予定の分離** | **次回** | 優先順位および変更ファイル数（`metadata.ja.json`・`review-notes.ja.md`・`README.md` 同期を含む）により次回。 |
| **【7位】`MonthCalendarView` AX5・非色覚・VO 統合** | **直した（一部見送り）** | `App/ReportsView.swift:86-93,165-206`（`.system(size: 9)` と固定 `height: 36` を廃止して `minHeight: 44` へ変更、`missed` に `xmark` を追加、連続日数へ `.accessibilityElement(children: .combine)` を適用）。`ScreenshotTests/ScreenshotTests.swift` の `--screenshot-ax5` 経路拡張は Windows 環境に Xcode が無いため見送り。 |
