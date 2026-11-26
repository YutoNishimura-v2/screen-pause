# ひと呼吸の初回体験レビュー 第2回

初回はアプリを選んだ場で制限を始める。ホームでは最初の1回をどう記録するか、Pro の購入画面では何を振り返れるかを示す。

## 比較した日本の App Store 掲載

- **Opal** は対象の制限をすぐに設定できることと、集中の成果を指標で見返せることを訴求する。確認時は評価4,041件、仕事効率化の無料ランキング76位。 [Opal](https://apps.apple.com/jp/app/opal-screen-time-control/id1497465230)
- **one sec** は開く直前に間を作って選び直せることを標準機能との差として説明し、1アプリで無料体験できることを明示する。確認時は評価7,803件。 [one sec](https://apps.apple.com/jp/app/one-sec/id1532875441)

両方ともアプリ内課金あり。比較は公開掲載の説明・評価と本アプリの SwiftUI ソースに基づく。2本の売上順位、競合のアプリ内画面、実際の転換率は未確認。

## 改善した5件

| 優先 | 変更前の箇所と問題 | 離脱・購入見送りにつながる理由 | 修正と現行の箇所 |
| --- | --- | --- | --- |
| 1 | `App/ScreenPauseApp.swift:197` に違いはあったが、呼吸と回数を名詞で並べていた | one sec の掲載は利用者の行動と結果をつなげており、同じ説明を自分に置き換えやすい。ひと呼吸では許可する価値が伝わりにくい | 開く前に間を置き、引き返した行動を数えると最初の画面で一文にする。 [初回画面](../App/ScreenPauseApp.swift#L192) |
| 2 | `App/ScreenPauseApp.swift:142,222,263` で対象選択の案内、OSの対象選択、時間設定を順に通った | Opal が手早い設定を訴求する市場で、対象を選んでから時刻の入力まで求めると試す前に離脱しやすい | OSの許可から選択へ直接つなぎ、選択画面のボタンで毎日同じ時間帯の制限を今すぐ始める。開始後に予定を編集できる。 [対象選択](../App/ScreenPauseApp.swift#L229)・[開始](../App/ScreenPauseApp.swift#L585) |
| 3 | `App/ScreenPauseApp.swift:158,476` は拒否と取り消しの区別が弱かった。初回の改修では起動直後の未決定も取り消し扱いにした | Opal が手早い設定を訴求する市場で、理由が不明な許可要求や設定済みの対象の選び直しは、継続利用を妨げる | 拒否・取り消しの理由を一文で示し、設定または再試行へ案内する。起動直後に未決定と報告された保存済みの利用者は、先に許可を再確認する。承認が戻ればそのままホームへ進み、実際に取り消された場合は再許可と対象の選択で元の予定を適用する。 [案内](../App/ScreenPauseApp.swift#L190)・[復帰判定](../App/ScreenPauseApp.swift#L496) |
| 4 | `App/ScreenPauseApp.swift:328` に日別の実数はあったが、0回から何をすると増えるかが分からなかった | Opal の指標は成果につながる。初日のゼロに手掛かりがないと、計測が動いているか分からず再訪しにくい | 0回のときだけ、制限画面で「開かずに戻る」を押すと記録が始まることを表示・読み上げする。 [今日の回数](../App/ScreenPauseApp.swift#L324) |
| 5 | `App/Paywall.swift:27,69` でプラン価格が成果の週比較・連続日数より先に出た | Opal は成果の振り返りを掲載で先に伝える。独自価値が見える前に価格が出ると、無料の標準機能で足りると判断しやすい | 回数の履歴、週比較、連続日数を最初のプラン価格より上に置く。無料の利用時間レポートはホームから開ける。 [Pro](../App/Paywall.swift#L20)・[無料レポート](../App/ScreenPauseApp.swift#L411) |

第2回の5件は修正済み。対応する検査名は次のとおり。

1. [the first screen explains the Screen Time difference in one Japanese line](../checks/domain.test.mjs#L444)
2. [welcome leads through iOS consent and the app picker directly to an active limit](../checks/domain.test.mjs#L451)
3. [authorization loss explains the state in Japanese and returns to retry or Settings](../checks/domain.test.mjs#L483) と [cold launch tries saved authorization before entering recovery](../checks/domain.test.mjs#L501)
4. [home explains the first return when today’s count is zero](../checks/domain.test.mjs#L551)
5. [Pro explains app-computed weekly comparison and streak before any plan price](../checks/domain.test.mjs#L561) と [a user without Pro opens the selected apps report from home](../checks/domain.test.mjs#L440)

## 初回の画面数

1. **ひと呼吸の初回画面**で「許可してアプリを選ぶ」を押す。
2. **iOSの許可画面**でスクリーンタイムへのアクセスを許可する。認証の追加表示は端末設定に従う。
3. **対象の選択画面**でアプリまたはカテゴリを選び、「今から1時間の制限を始める」を押す。保存時刻から1時間の毎日の予定を登録し、シールドを適用してホームに進む。 [許可から選択](../App/ScreenPauseApp.swift#L467)・[シールド適用](../Shared/ScreenTime.swift#L251)

通常経路は **3画面**。開始後のホームで制限状態を確認できる。60秒以内の実測、追加認証の出方、ライト・ダーク・最大文字サイズでの実表示は実機・CI待ち。 [Node のソース検査](../checks/domain.test.mjs#L451)・[撮影とデモ計時](../ScreenshotTests/ScreenshotTests.swift#L20)

## round 2b

日本の App Store 掲載を再確認した。Opal は簡単なブロック設定と集中レポートを、one sec は開く直前の待ちと1アプリの無料利用を説明する。インストールから購入画面までの比較は、この公開情報とひと呼吸の実装に基づく。競合アプリ内の画面遷移と所要時間は未確認。 [Opal](https://apps.apple.com/jp/app/opal-screen-time-control/id1497465230)・[one sec](https://apps.apple.com/jp/app/one-sec/id1532875441)

| 場面 | 指摘と比較 | 対応 |
| --- | --- | --- |
| インストール | 掲載文は曜日・時刻の入力が先と読めた。Opal が設定の手軽さを説明する中、選択直後に試せることが伝わらなかった。 [docs/app-store/metadata.ja.json:5](app-store/metadata.ja.json#L5) | 修正済み。すぐに最初の1時間を始め、曜日・時刻はあとで編集できると記載。 [the listing describes the immediate first hour before schedule editing](../checks/first-minute.test.mjs#L15) |
| 許可 | 保護者による制限や一時的な接続失敗でも、拒否時と同じ設定ボタンが出ていた。one sec は掲載で必要な設定手段を明示しており、ひと呼吸も状態に応じた行動を案内する必要がある。 [App/ScreenPauseApp.swift:195](../App/ScreenPauseApp.swift#L195) | 修正済み。設定リンクは拒否・取り消し時のみ表示。保護者への確認や再試行を案内する。 [permission recovery shows Settings only for denied or revoked access](../checks/first-minute.test.mjs#L22) |
| 最初の制限 | 保存が成功する前に選択画面を閉じていた。Opal が対象を簡単に設定できると訴求する中、失敗時に選択画面を開き直す手間があった。 [App/ScreenPauseApp.swift:271](../App/ScreenPauseApp.swift#L271) | 修正済み。失敗時は選択画面と対象を保持し、その場で保存失敗を知らせ、同じボタンで再試行できる。 [first save failure stays in the picker with its selection and retry feedback](../checks/first-minute.test.mjs#L28) |
| 最初に戻る | 0回の案内はシールドのボタン名だけを示し、そこに至る行動が抜けていた。one sec の掲載は対象アプリを開くことと介入を結びつけている。 [App/ScreenPauseApp.swift:330](../App/ScreenPauseApp.swift#L330) | 修正済み。0回かつ制限中は対象アプリを開くところから案内。待機中は制限開始後に記録できることを示す。 [an active limit gives a zero-count user the real first-stop action](../checks/first-minute.test.mjs#L38) |
| 購入画面の無料範囲 | 回数の履歴と利用時間レポートの無料範囲が価格の手前で区別できなかった。one sec は掲載で無料枠を明示し、Opal はレポートを訴求している。 [App/Paywall.swift:26](../App/Paywall.swift#L26) | 修正済み。価格より先に利用時間レポートは無料と明示。 [the paywall states the free report boundary before plan prices](../checks/first-minute.test.mjs#L48) |
| 購入できるプラン | 年額だけ取得できないと、価格なしの年額が選択されたまま購入ボタンが出なかった。one sec が掲載で月額・年額・買い切りを示すように、選べるプランは購入できる状態にそろえる。 [App/Paywall.swift:32](../App/Paywall.swift#L32) | 修正済み。価格を取得できたプランだけを表示し、選択中のプランがなければ取得済みの先頭を選ぶ。再読み込みは維持。 [partial StoreKit results select a purchasable plan and hide unpriced choices](../checks/first-minute.test.mjs#L55) |
| シールド待機の残り時間 | one sec は深呼吸のアニメーションを掲載で示す。ひと呼吸の実シールドは残り時間を表示せず、利用者は経過を見計らって再押下する。 [Shield/Shield.swift:26](../Shield/Shield.swift#L26) | 保留。シールドは iOS が描画する。追加確認なしで表示が切り替わるか、OS が再描画する条件を実機で確かめてから扱う。 |

新規の Node 検査は6件。変更前は全件が対応する条件で失敗し、変更後は6件とも通過した。Xcode のある環境でのビルドと表示確認、実機の許可画面・シールド・購入は未確認。

## round 3

2〜7日目は、記録を振り返れること、制限のたびに自分で選び直せること、翌日の予定が分かることを評価した。Opal の集中レポートと手早い設定、one sec の開く直前の介入を、日本の App Store 掲載を基に比較した。 [Opal](https://apps.apple.com/jp/app/opal-screen-time-control/id1497465230)・[one sec](https://apps.apple.com/jp/app/one-sec/id1532875441)

| 場面 | 変更前の指摘 | 修正と検査 |
| --- | --- | --- |
| 2〜7日目の振り返り | Opal は集中の成果を数値で振り返れる。週比較の条件を満たすまでは記録があっても待つように表示していた。 `App/ReportsView.swift:76–84` | Pro の週比較がまだできないときは、当日を含む直近7日間の「開かずに戻れた回数」を表示する。 [実装](../App/ReportsView.swift#L84)・[検査](../checks/first-minute.test.mjs#L76) |
| 5回目の中断 | one sec のように開く直前に選び直せるが、毎回同じ文言で直前までの選択が伝わらなかった。 `Shield/Shield.swift:32` | 当日4回の時点で「開かずに戻ると5回目です」と示す。5回を記録した後、次にシールドが構成されると達成を表示する。 [実装](../Shared/ShieldAppearance.swift#L13)・[検査](../checks/first-minute.test.mjs#L86) |
| 予定編集の保存 | Opal の設定の手軽さに対して、曜日を全部外すと保存できず、画面の案内は時間の条件しか説明していなかった。 `App/ScreenPauseApp.swift:306–312` | 曜日未選択と15分未満それぞれに、直す項目を表示する。 [実装](../App/ScreenPauseApp.swift#L307)・[検査](../checks/first-minute.test.mjs#L93) |
| 日をまたぐ予定 | Opal の設定の手軽さに対して、一覧の時刻表記だけでは終了が翌日だと判断しづらかった。 `App/ScreenPauseApp.swift:446–450` | 一覧では終了時刻に「翌日」を添え、編集時は曜日が開始日を指すと表示する。 [実装](../App/ScreenPauseApp.swift#L462)・[検査](../checks/first-minute.test.mjs#L99) |
| 次に戻る目安 | one sec は介入するタイミングを明示する。ホームの待機中表示には次の制限の日時がなく、次に戻る目安を得られなかった。 `App/ScreenPauseApp.swift:364–370` | ホームに次の制限開始日時を表示する。再訪の案内はアプリ内に置いた。 [実装](../App/ScreenPauseApp.swift#L373)・[検査](../checks/first-minute.test.mjs#L106) |

### レビューの残件

- 許可の復旧中に保存が失敗した場合は、選択画面を開いたまま元の予定を再開できなかったと表示する。 [実装](../App/ScreenPauseApp.swift#L637)・[検査](../checks/first-minute.test.mjs#L28)
- 再読み込みで年額が取得できたら、自動で選ばれた代替プランから年額へ戻す。利用者が手動で選んだプランは選択を保持する。無料体験の表示は StoreKit の適格判定に従う。 [実装](../App/Paywall.swift#L153)・[検査](../checks/first-minute.test.mjs#L66)
- 実シールドのライブカウントダウンは保留。iOS はデータソースから静的なラベルを取得して描画する。経過時間だけで毎秒の再描画を要求できる API がなく、表示を動かすと残り秒数が止まったままになる可能性がある。現在は保存済みの待機開始時刻で解除を判定し、シールドは再押下を案内する。 [Apple の構成 API](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource)・[待機と解除](../Action/Action.swift#L43)

利用時間レポートは引き続き無料。5件の変更箇所を個別に外すと、対応するソース検査はそれぞれ失敗した。Node 全件はランナー実行待ち。実機でのシールド描画、アプリの表示、購入の再読み込みは未確認。
