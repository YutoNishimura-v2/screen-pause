# 独立批評 Round 5（reference app との販売力比較）

**総合スコア: 5.7 / 10（7軸合計 40 / 70）** — **現状のままでは reference app 並みには売れない。**

Screen Time の制御、祝日・日またぎ・Pro 失効の境界整合、初回オンボーディングのタップ数圧縮は堅実に実装されている。一方、**収益化の核（解除不可ロックと長めの段階的待機）と継続理由（初週の削減フィードバック・時間帯別の利用可視化）**で reference app に大きく負けており、購入動機・2〜7日目の定着・App Store 訴求の3点で改善が必要。

> [!NOTE]
> 本批評はアプリ本体・拡張機能・App Store 原稿・Round 4 照合文書（`docs/benchmark.md`）のソース読解に基づく。実機画面およびシミュレータ撮影画像は本環境で確認していないため、視覚レイアウト・コントラスト・AX5 折り返し・VoiceOver の実挙動に関する判断にはすべて `推測` を付記した。

---

## 7軸スコアリング

| # | 評価軸 | 点数 | 一行理由 |
| --- | --- | ---: | --- |
| 1 | 初回1分（導入〜最初のブロックまで・タップ数・許可含む） | **7 / 10** | アプリ側2タップ＋OS許可1〜2回＋対象選択1〜2回（計約5〜7タップ）で即ブロックできるが、`immediateSchedule` が導入時の分単位を毎日の定期予定に固定し、導入直後の試行導線も弱い（`App/ScreenPauseApp.swift:607-611`）。 |
| 2 | ホームの明快さ（主指標1つ・不要情報の排除） | **5 / 10** | 「今日、開かずに戻れた回数」を大きく置く意図はあるが、実態は4〜5セクション・約10行の `Form` に集中タイマー・予定追加・課金案内が同居し、対象アプリ変更だけ予定編集の奥に隠れている（`App/ScreenPauseApp.swift:316, 330-492`、見た目 `推測`）。 |
| 3 | 制限・待機体験（制限文言・ライブ計測・段階的待機） | **6 / 10** | 「今日 N回目・M秒」の段階延長（上限60秒）と落ち着いた待機文言を揃えたが、OS 制限画面に解除可能時刻も「ひと呼吸で確認」の誘導も出ず、待機中も副ボタン名が固定のままで迷う（`Shield/Shield.swift:30-50`）。 |
| 4 | 購入画面（有料内容・価格・試用・復元・一行価値） | **5 / 10** | 価格・14日試用・復元・規約リンクは揃うが、reference app が有料核にする「厳格モード（解除なし）」が無料側にあり、年額割引率・試用バッジ・月間カレンダー価値が価格前に伝わらない（`App/Paywall.swift:25-82`、`App/ScreenPauseApp.swift:429-436`）。 |
| 5 | 2〜7日目の継続（連続日数・カレンダー・レポート・残す理由） | **5 / 10** | 月間カレンダーと連続日数は Pro 画面の奥にあり、無料レポートは「時間帯別の利用」も「アプリ別内訳」もなく、「今週へらせた時間」が初週＋月曜跨ぎ（最短8〜14日目）まで空欄になる（`Shared/UsagePeriods.swift:42-57`、`Report/UsageReport.swift:23-36`）。 |
| 6 | Store 公開準備（掲載文・スクショ見出し・Family Controls 審査メモ） | **5 / 10** | App Review 4.10 対策と審査メモの土台はあるが、Round 4 の段階的待機・月間カレンダーが掲載文・審査メモに未反映で、Store 用訴求キャプション画像と `AppIcon` 設定が欠けている（`docs/app-store/metadata.ja.json:4-5`、`project.yml:28-38`）。 |
| 7 | アクセシビリティ（Dynamic Type・VoiceOver・コントラスト） | **7 / 10** | `@ScaledMetric`・`ViewThatFits`・44pt 確保・日本語読み上げラベルは丁寧だが、`MonthCalendarView` の固定9ptチェックと7列グリッドが AX5 で窮屈・低コントラストになりやすく（`推測`）、AX5 テストも導入導線止まり（`App/ReportsView.swift:144-192`）。 |

---

## reference app に負けている改善点（販売インパクト順）

### 1. 有料価値の再設計と Paywall の訴求強化（厳格モード・延長上限・年額お得度・読み込み待ち解消）

- **対象箇所**:
  - `Shared/Domain.swift:26-32`（`enum PaywallReason`）
  - `Shared/Domain.swift:107, 169`（`escalationCap = 60`, `secondsRange = 0...30`）
  - `App/ScreenPauseApp.swift:423, 429-436, 464, 481`（厳格モードの解放範囲、`store.revision == 0` 時の無効化）
  - `App/Paywall.swift:25-82`（見出し直下の価値訴求・年額行・機能一覧の位置）
- **負けている理由**: reference app は有料プランで「解除できないモード」「開くたびに延びる待機」「月間カレンダー」「時間帯別利用」を売っている。本アプリは厳格モード（解除なし）を無料で渡し、Pro の延長上限も60秒と控えめなため、無料のまま満足されやすい。また `Paywall` は「Pro でできること」が購入ボタンの下（`App/Paywall.swift:76`）に置かれ、月間カレンダーへの言及や年額の割引率（¥4,800/年 vs ¥580×12＝¥6,960）が無く、StoreKit 取得前は Pro ボタンが理由なく押せない（`App/ScreenPauseApp.swift:423, 464, 481`）。
- **変更内容**:
  1. App Review 4.10 遵守のため Apple の利用時間レポート（`UsageReportView`）は無料のまま維持しつつ、アプリ独自ルールである**スケジュール時の厳格モード**を `PaywallReason.strictMode` として Pro 限定にし、`PauseWindow.escalationCap` を `60` → `300` 秒、`PausePreferences.secondsRange` を `0...60` 秒へ引き上げる。
  2. `App/Paywall.swift` で購入ボタンより上に3点の独自価値（厳格モード・最大300秒の段階延長・月ごとの達成カレンダー）を簡潔に並べ、年額プラン行自体に「14日間無料」「月額比 約31%お得」を表示する。
  3. `store.revision == 0` による無言の `.disabled` を外し、タップ時はロード中でも Paywall を開いて進めるようにする。
- **機械判定できる合格条件**:
  - **Node 純粋関数テスト**: `PaywallReason.strictMode.isAvailable(on: .free) === false` かつ `.pro === true`、`waitSeconds(n, base: 10, growth: 2, cap: 300)` が `[10, 20, 40, 80, 160, 300]` を返すこと。
  - **Node ソース検査**: `Shared/Domain.swift` に `case strictMode` と `escalationCap = 300` があり、`App/Paywall.swift` で「厳格モード」「月ごとの」または「カレンダー」が購入ボタン（`Button(hasTrial ?`）より前に出現し、`.yearly` 行に「14日間無料」が含まれ、`App/ReportsView.swift` の `UsageReport` 部分には引き続き `Paywall` / `ProAccess` 参照が無いこと。

### 2. 2〜7日目の即効フィードバック化と時間帯別・アプリ別レポートの追加

- **対象箇所**:
  - `Shared/UsagePeriods.swift:42-57`（`savedTime` の7日＋週跨ぎ待機条件）
  - `Report/UsageReport.swift:21-53`（`.daily` 固定集計とアプリ別内訳の破棄）
  - `Shared/UsageReportView.swift:3-55`（`UsageSummary`, `UsageReportView`）
  - `App/ReportsView.swift:40-45`（`DeviceActivityFilter`）
- **負けている理由**: reference app は時間帯別の利用状況を可視化して「いつ削るか」に気づかせる。本アプリの `savedTime` は7日間の基準週完了＋月曜起点の翌週経過（`week > last`, `today > last`）を待つため、**2〜7日目（水曜導入なら最長13日目まで）ずっと「初週と今週の利用時間がそろうと表示されます。」のまま数字が出ない**（`Shared/UsageReportView.swift:25`）。さらに `Report/UsageReport.swift:32-36` はアプリ別の利用時間を合計へ潰して捨てており、時間帯別の集計も行わない。
- **変更内容**:
  1. `Shared/UsagePeriods.swift` に、7日基準が揃う前でも2日目以降（完了日が2日以上ある場合）に「昨日との比較」または「直近2〜3日平均との差」を返す純粋関数（例: `earlyDelta(daily:today:calendar:)`）を追加し、`UsageReportView` で初週待ちの空白を埋める。
  2. `Report/UsageReport.swift` でアプリ別合計（上位アプリ）と時間帯別（`0...23` 時）を集計できるよう `UsageSummary` を拡張し、`UsageReportView` に折りたたまず表示する。
- **機械判定できる合格条件**:
  - **Node 純粋関数テスト**: 導入2日目（前日と本日の記録あり）で新しい比較ヘルパーが非 `null` の差分を返し、8〜14日目以降の既存 `savedTime` 境界テスト（`checks/domain.test.mjs:259-273`）がすべて維持されること。
  - **Node ソース検査**: `Shared/UsageReportView.swift` の `UsageSummary` がアプリ別・時間帯別のフィールドを持ち、`Report/UsageReport.swift` がアプリ単位と時間帯単位を集計しており、`App/ReportsView.swift` の無料レポート経路は維持されること。

### 3. App Store 掲載文・審査メモの Round 4 同期と Store 用キャプション画像・AppIcon の整備

- **対象箇所**:
  - `docs/app-store/metadata.ja.json:4-5`（`searchTerms` 37/100文字、段階延長・カレンダー未記載）
  - `docs/app-store/review-notes.ja.md:7-18`（Round 4 機能の記載漏れ、テスト手順1〜6止まり）
  - `ScreenshotTests/ScreenshotTests.swift:61-103` & `.github/workflows/screenshots.yml:85-93`（`03` 欠番、待機・カレンダー未撮影、Store 用見出しなし）
  - `project.yml:28-38`（`ASSETCATALOG_COMPILER_APPICON_NAME` 未設定、`AppIcon.appiconset` 未配置）
- **負けている理由**: reference app は Store 画像の一言訴求でダウンロードを決めるが、本アプリは素の `Form` スクショを CI で撮るだけで Store 用キャプション設計が無く、掲載文と審査メモにも Round 4 の強み（段階的に延びる待機・月間カレンダー）が書かれていない（`STATUS.md:19` でも未対応を認識）。検索語も 100 文字枠のうち 37 文字しか使っていない。
- **変更内容**:
  1. `docs/app-store/metadata.ja.json` の `description` に「開くたびに延びる待ち時間」「月ごとの達成カレンダー」を追記し、`searchTerms` を 80〜100 文字の日本語検索語（SNS, YouTube, ブロック, デジタルデトックス, 集中タイマー 等）へ拡充する。
  2. `docs/app-store/review-notes.ja.md` に Round 4 機能の記載と、段階的待機・月間カレンダーの確認手順、および `PauseReport` 拡張が App Group を持たず端末外へ送信しない説明を追記する。
  3. `docs/app-store/screenshots.ja.json` 等で各 Store スクショの日本語キャッチコピーを定義し、`ScreenshotTests.swift` と `.github/workflows/screenshots.yml` にカレンダー・段階的待機の撮影を追加する。
  4. 選定したアイコン SVG から `App/Assets.xcassets/AppIcon.appiconset` を生成し、`project.yml` に `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` を設定する。
- **機械判定できる合格条件**:
  - **Node ソース検査**: `docs/app-store/metadata.ja.json` で `subtitle.length <= 30`、`50 <= searchTerms.length <= 100`、`description` に「延びる待ち時間」および「カレンダー」（または「月ごと」）を含むこと。`docs/app-store/review-notes.ja.md` が段階延長・月間カレンダーのテスト項目を含み、`project.yml` に `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` が定義され、`App/Assets.xcassets/AppIcon.appiconset/Contents.json` が存在すること。

### 4. OS シールド待機中の「解除可能時刻」提示と状態別ボタン表示

- **対象箇所**:
  - `Shared/ShieldAppearance.swift:21-35`（`secondary`, `waitStatus`）
  - `Shield/Shield.swift:30-50`（待機中の `subtitle` と `secondaryButtonLabel`）
  - `App/ScreenPauseApp.swift:354-362`（ホーム上の待機終了文言）
- **負けている理由**: OS のシールド拡張はライブタイマーを動かせない制約がある一方、現在「10秒待って開く」を押した後の `Shield` は副ボタン名が変わらず `"10秒待って開く"` のままで、本文も `"ひと呼吸。時間が過ぎたら、もう一度押せます。"` としか出ない（`Shield/Shield.swift:30-31, 48-50`）。何時何分何秒に開けるのか、一時解除が5分間有効なのかが伝わらず、利用者は勘で連打するかタップが効いていないと誤解する。またホームの `"もう一度押すと開けます。"`（`Shared/ShieldAppearance.swift:34`）も、ホーム画面上に押すボタンが無いため不親切。
- **変更内容**:
  1. `Shared/ShieldAppearance.swift` に `pendingSubtitle(unlockAt:accessMinutes:calendar:)` を追加し、静的表示でも確定時刻が分かるよう `"HH:mm:ss 以降にもう一度押すと5分間だけ開けます。残り秒数は「ひと呼吸」で確認できます。"` を返す。
  2. `Shield/Shield.swift:48-50` で `state?.activePending(at: now)?.app == token` のとき副ボタン文言を `"準備ができたら押して開く"` 等へ切り替え、タップ済みであることを明示する。
  3. `App/ScreenPauseApp.swift:354-362` と `Shared/ShieldAppearance.swift:34` で「対象アプリを開いて再度押すと5分間開けます」と戻る先を明示する。
- **機械判定できる合格条件**:
  - **Node 純粋関数テスト**: `unlockReadyTime(requestedAt, waitSeconds)` が分・時・午前0時またぎを含め正確な `HH:mm:ss` を返すこと。
  - **Node ソース検査**: `Shield/Shield.swift` が `activePending` 一致時に専用の `secondaryButtonLabel` を使い、`pending.date.addingTimeInterval(pending.wait)` を `Shared/ShieldAppearance.swift` の待機文言生成へ渡しており、出力文言に時刻と「5分」が含まれること。

### 5. ホーム画面の情報整理（設定項目の退避と対象アプリ変更の直接導線）

- **対象箇所**:
  - `App/ScreenPauseApp.swift:130-139`（右上の「設定」画面）
  - `App/ScreenPauseApp.swift:316, 330-492`（`homeForm` と `scheduleForm` の対象アプリ変更ボタン）
- **負けている理由**: 現在のホーム（`App/ScreenPauseApp.swift:330-492`）は「今日の回数」「次の制限開始＋予定一覧＋予定追加」「厳格モード＋集中時間ピッカー＋開始ボタン」「利用時間＋回数履歴＋待ち時間とメッセージ」を同じ `Form` に縦積みし、iOS 設定画面のように見える（`推測`）。一方で頻度の高い「対象アプリの追加・変更」は `scheduleForm` の中（`App/ScreenPauseApp.swift:316`）にしかなく、2階層潜らないと辿り着けない。
- **変更内容**:
  1. `homeForm` を最大3セクション（①今日の回数・連続日数／待機カウントダウン、②いまの状態＋「対象アプリを変更」＋「集中を開始」、③「利用時間・記録」）に整理する。
  2. 「制限の予定」一覧と編集、「待ち時間とメッセージ」、法務リンクを右上の「設定」画面（`App/ScreenPauseApp.swift:132-137`）へ移し、ホームの視覚的ノイズを減らす。
- **機械判定できる合格条件**:
  - **Node ソース検査**: `App/ScreenPauseApp.swift` の `homeForm` 内の `Section` 数が3以下であり、`homeForm` から `scheduleForm` を経由せず直接 `openPicker`（または対象アプリ変更導線）を呼べること。また `navigationTitle("設定")` 配下に `CustomPauseView` / 予定管理と `LegalLinks()` が配置されていること。

### 6. 初回1時間お試しと毎日の定期予定の分離、および初日試行導線

- **対象箇所**:
  - `App/ScreenPauseApp.swift:249-250, 268, 607-611, 644`（`immediateSchedule`, `save()`）
  - `App/ScreenPauseApp.swift:336-338, 374-394`（`count == 0` 時のガイド）
- **負けている理由**: オンボーディングで「今から1時間の制限を始める」を押すと `immediateSchedule(at: .now)` が `weekdays: Set(1...7)` の**毎日繰り返す定期予定**として保存される（`App/ScreenPauseApp.swift:607-611`）。14:37 に試した利用者は、翌日以降も毎日 14:37〜15:37 に無意識にブロックされる。またホーム遷移直後に「選んだアプリを今すぐ開いて試す」視覚的誘導が小さい脚注1行しかない（`App/ScreenPauseApp.swift:374-376`、`推測`）。
- **変更内容**:
  1. 初回セットアップ時は固定の毎日予定を勝手な分刻みで登録せず、1時間限定のワンショット集中（`focusEnd = now + 3600`）を開始するか、定時枠（例: 22:00〜24:00）＋初回1時間集中を分けて登録し、説明文（`249-250`）も実態に合わせる。
  2. `count == 0 && blocking` のとき、ホームに「いま制限中です。選んだアプリを開いて制限画面を試しましょう」という明確な初日ガイドカードを表示する。
- **機械判定できる合格条件**:
  - **Node 純粋関数テスト**: 初回起動の保存処理が `focusEnd = now + 3600` で即時ブロックを有効にしつつ、導入分刻み（例: `14:37〜15:37`）の毎日繰り返し `WeeklySchedule` を生成しないこと。
  - **Node ソース検査**: `App/ScreenPauseApp.swift` から導入時刻そのままの `(minute, (minute + 60) % 1440)` 毎日スケジュール生成が除かれ、`count == 0` かつ `blocking` 時に初回試行案内が表示されること。

### 7. `MonthCalendarView` の AX5 対応・非色覚コントラスト改善・VoiceOver 統合

- **対象箇所**:
  - `App/ReportsView.swift:72-76, 144-192`（`ProgressHistoryView` 連続日数表示、`MonthCalendarView`）
  - `Shared/ShieldAppearance.swift:8`（`UIColor.systemIndigo` と白文字のダークモード時コントラスト、`推測`）
  - `ScreenshotTests/ScreenshotTests.swift:16-18, 61-103`（AX5 撮影範囲）
- **負けている理由**: `MonthCalendarView` は `Image(systemName: "checkmark").font(.system(size: 9))`（`App/ReportsView.swift:177`）と `frame(height: 36)`（`149`）を使っており、Dynamic Type 最大（AX5）で2桁の日付やチェックが7列グリッド内で窮屈になり文字切れを起こす恐れがある（`推測`）。また「守れなかった日」が `Color.secondary` の 1pt 枠線のみ（`188`）で、ライト/ダーク両方で「予定なし」との識別性が弱い（`推測`）。`Section("連続日数")` の `"3日"`（`73`）はラベルと結合されておらず、`testFirstBlockDemoAtAX5`（`ScreenshotTests.swift:16-18`）もレポート画面や Paywall を検査していない。
- **変更内容**:
  1. `App/ReportsView.swift` で固定 `.system(size: 9)` を廃止して `@ScaledMetric` または `.caption2` を使い、空きセルの固定 `height: 36` を `minHeight` に変える。`missed` 状態は `xmark` 記号など非色覚の手掛かり＋高コントラスト枠線で明示し、`連続日数` 行に `.accessibilityElement(children: .combine)` を付ける。
  2. `ScreenshotTests/ScreenshotTests.swift` の AX5 テストで `ReportsView`（カレンダー含む）と `Paywall` も遷移・`isHittable` 確認対象に加える。
- **機械判定できる合格条件**:
  - **Node ソース検査**: `App/ReportsView.swift` の `MonthCalendarView` に `.system(size: 9)` や固定 `frame(height: 36)` が含まれず、`missed` 用の非色覚アイコン（`xmark` 等）と連続日数の `.accessibilityElement(children: .combine)` が存在すること。また `ScreenshotTests/ScreenshotTests.swift` の `--screenshot-ax5` 経路が `home-report` および `home-paywall` を開くこと。
