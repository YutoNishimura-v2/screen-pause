# 機能の照合（Round 4）

国内で売れているスマホ依存対策アプリの有料機能と照らし合わせ、足りない分だけを足しました。記録はすべて端末内の共有領域（App Group）に保存し、外部へは送りません。

| 項目 | 状態 | 場所 |
| --- | --- | --- |
| 1. 段階的な待ち時間（Pro） | 追加 | 下記 |
| 2. 月ごとの記録 | 追加（連続日数は既存） | 下記 |
| 3. 待ち時間の画面 | 追加（固定の文言は既存） | 下記 |

## 1. 段階的な待ち時間（Pro）

- 追加：同じ日の N 回目の一時解除の待ち時間は「基本 × 2^(N-1) 秒」で、上限は 60 秒（10→20→40→60）。純粋関数は Shared/Domain.swift:110-129 にあります。
- 追加：0 秒と段階延長の同時指定は入力検証で拒否し、固定の 0 秒設定だけを残します（Shared/Domain.swift:187-191、App/CustomPauseView.swift:21-43）。
- 追加：日付の区切りはローカル時刻の午前 0 時（Shared/Domain.swift:194-200）。当日の解除回数は Shared/Domain.swift:246-254 で数えます。解除を許可した唯一の場所（Action/Action.swift:73）で加算します。
- 追加：次の解除に効く待ち時間は Shared/ScreenTime.swift:60-66 で決まります。保存した設定そのものは Shared/ScreenTime.swift:55-57 です。
- 追加：Pro の設定画面のスイッチ（App/CustomPauseView.swift:21-35）と、購入画面の説明（App/Paywall.swift:79）。
- 追加：無料版は鍵付きの行に理由を 1 行だけ出します（App/ScreenPauseApp.swift:473-482）。
- 既存：無料版の待ち時間は 10 秒固定です（Shared/Domain.swift:171）。
- 既存：解除できないモードは厳格モードです（Shared/Domain.swift:92、Shared/ScreenTime.swift:80、App/ScreenPauseApp.swift:429）。

## 2. 月ごとの記録

- 既存：連続日数（Shared/Domain.swift:353、App/ReportsView.swift:72）。
- 追加：日ごとの結果を 1 日 1 件、最大 366 日分だけ保存します（Shared/Domain.swift:302-326）。一度「守れなかった」になった日は、あとから上書きしません。
- 追加：月の表のモデルが、保存済みの結果だけから各日を「守れた／守れなかった／予定なし」に分けます（Shared/Domain.swift:328-351）。予定変更や未終了の夜間ブロックで過去の未記録日を「守れなかった」と推測しません。
- 追加：表示は連続日数のすぐ下で、前後の月にも移れます（App/ReportsView.swift:77-82・114）。

## 3. 待ち時間の画面

- 既存：止まったときの文言（Shared/ShieldAppearance.swift:13）。
- 追加：「今日 3回目・40秒」の表示（Shared/ShieldAppearance.swift:26）と、落ち着いた 1 文＋残り秒数（Shared/ShieldAppearance.swift:31-35）。名言や責める言葉は入れていません。
- 制限画面は iOS が描画する拡張機能で、タイマーを動かせません（docs/critique-r2.md:70）。そのため Shield/Shield.swift:19-23・38-40 では、回数と秒数を動かない表示で出します。
- 毎秒の残り時間はアプリ本体で描き、待ち時間の一致と有効期限を共通判定（Shared/ScreenTime.swift:86-96、Shared/Domain.swift:136-151）で揃えます。ホームの「一時解除の待ち時間」（App/ScreenPauseApp.swift:341-366）と、制限画面のプレビュー（App/ShieldDemoView.swift:37-76）です。
