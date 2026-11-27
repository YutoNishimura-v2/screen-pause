# App Store 提出チェックリスト

提出版は **1.0.0（ビルド1）**。日本価格は確定済み（月額 ¥600・年額 ¥4,800）。公開URL、審査連絡先は所有者が確定します。公開前に、選定済みアイコンを含むMacでのアーカイブと署名済み実機ビルドを確認します。

- [ ] **開発者アカウント**　Apple Developer Programに登録し、Account Holderで契約を確認する。有料販売用の契約、税務、銀行情報も設定する。 [Apple Developer Program](https://developer.apple.com/programs/) · [App Store Connect](https://appstoreconnect.apple.com/)
- [ ] **識別子・配布権限**　下表の6 IDとApp Groupを登録し、申請対象はAccount HolderがIDごとに配布承認を申請する。承認後に配布プロファイルへ反映する。 [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/) · [Appleの拡張別申請手順](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
- [ ] **規約とサポート**　公開リポジトリの公開ブランチでGitHub Pagesのソースを `/docs` に設定する。公開された `legal/privacy.html` と `legal/terms.html` をログアウト状態で開く。連絡可能なAppサポートURLを登録し、購入画面と「設定」から実URLを開ける署名済みビルドを確認する。 [GitHub Pagesの公開設定](https://docs.github.com/ja/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [ ] **商品と価格**　下表の2商品を登録し、日本の価格（月額 ¥600・年額 ¥4,800）と地域別の価格を設定する。月額・年額は同じサブスクリプショングループの同じレベルに置き、年額に対象者向けの2週間無料オファーを設定する。初回の2商品はアプリ版と一緒に審査へ送る。 [サブスクリプションの登録](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/) · [アプリ内課金の提出](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/)
- [ ] **署名・提出**　下記に従って署名する。App Store Connectで日本語掲載文、公開プライバシーURL、App Privacy、審査メモ、連絡先、年齢制限、スクリーンショット、各商品の審査用画像を登録して提出する。 [App Store Connect](https://appstoreconnect.apple.com/) · [提出手順](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)

## 配布対象の識別子

App Group は `group.jp.screenpause.app`。本体・監視・表示・操作・ウィジェットの5 IDに追加する。レポート拡張にはFamily Controlsのみを付ける。配布承認は下表の申請対象5 IDそれぞれの状態を確認する。

| 対象 | バンドル ID | Family Controls の配布申請 |
| --- | --- | --- |
| アプリ本体 | `jp.screenpause.app` | [申請](https://developer.apple.com/contact/request/family-controls-distribution) |
| 制限の監視 | `jp.screenpause.app.monitor` | [申請](https://developer.apple.com/contact/request/family-controls-distribution) |
| シールドの表示 | `jp.screenpause.app.shield` | [申請](https://developer.apple.com/contact/request/family-controls-distribution) |
| シールドの操作 | `jp.screenpause.app.action` | [申請](https://developer.apple.com/contact/request/family-controls-distribution) |
| 利用時間レポート | `jp.screenpause.app.report` | [申請](https://developer.apple.com/contact/request/family-controls-distribution) |
| ウィジェット | `jp.screenpause.app.widgets` | 対象外。App Groupのみ。 |

## 商品（確定価格）

| 商品 | 商品 ID | 種別 | 日本の価格 |
| --- | --- | --- | --- |
| ひと呼吸 Pro 月額 | `jp.screenpause.app.pro.monthly` | 1か月・自動更新 | ¥600／月 |
| ひと呼吸 Pro 年額 | `jp.screenpause.app.pro.yearly` | 1年・自動更新・14日間無料体験 | ¥4,800／年（月額比 約33%お得） |

## 署名・提出時の照合

1. [A・B・Cのアイコン候補](icon/candidates.md)から本人が選んだ案を `docs/icon/chosen.txt` に小文字1文字で記入する。Chromiumがある環境で `node tools/app-icon.mjs --write` で1024pxのAppIconを生成し、`node tools/app-icon.mjs` で照合する。空欄の間は「未選択」と表示される。
2. MacでXcodeGenからプロジェクトを生成する。配布ターゲット6つの署名チームをそろえる。本体ターゲットのReleaseビルド設定に `SCREEN_PAUSE_LEGAL_BASE_URL` を追加し、GitHub Pagesの `legal` ディレクトリのHTTPS URL（末尾にファイル名を含めない）を指定する。自動署名で配布プロファイルを更新するか、6 IDに合う配布プロファイルを指定する。再生成した場合はチームとURLを再適用する。 [Xcodeの配布手順](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
3. 実機向けにReleaseをアーカイブし、Xcode Organizerでアプリを検証する。全6バンドルのバージョン・ビルド番号・署名・`PrivacyInfo.xcprivacy` と、プライバシーレポートを確認する。既に同じ版のビルド1がアップロード済みなら `CURRENT_PROJECT_VERSION` を上げる。
4. TestFlightまたは配布相当の実機で、起動、[審査メモのシールド操作](app-store/review-notes.ja.md)、購入・復元と実価格、両方の画面からの公開規約リンクを確認する。年額の無料体験の有無を対象アカウント別に確認する。
5. [日本語掲載文](app-store/metadata.ja.json)と[プライバシー回答案](app-store/app-privacy.ja.md)を転記し、審査メモを添える。[掲載用キャプション](app-store/screenshots.ja.md)を対応する撮影画像に載せる。App Store ConnectではApple標準EULAを使用し、プライバシーポリシーURL欄に公開URLを入れる。掲載文の無料期間と最終的な商品設定を照合する。 [App Review 3.1.2](https://developer.apple.com/app-store/review/guidelines/#subscriptions)

## App Review 4.10の対応方針（決定済み）

選んだアプリのスクリーンタイム利用時間レポートを無料にする。Proは、アプリ独自の回数履歴・週比較と連続日数、複数の制限予定、待ち時間と制限画面のメッセージの変更に限る。提出用ビルドでは、未購入時とProの期間終了後に同じレポートを開けることを確認する。 [審査メモ](app-store/review-notes.ja.md)

> You may not monetize built-in capabilities provided by the hardware or operating system, such as Push Notifications, the camera, or the gyroscope; or Apple services and technologies, such as Apple Music access, iCloud storage, or Screen Time APIs.

[App Review Guidelines 4.10](https://developer.apple.com/app-store/review/guidelines/#monetizing-built-in-capabilities)
