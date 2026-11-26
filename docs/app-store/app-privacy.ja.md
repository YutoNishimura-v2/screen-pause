# App Privacy の回答案

| App Store Connect の質問・項目 | 回答案 |
| --- | --- |
| アプリまたは統合した第三者パートナーがデータを収集するか | いいえ |
| 製品ページのラベル | データの収集なし |
| トラッキング | なし |
| ユーザーに関連付けられた収集データ | なし |
| プライバシーポリシーURL | 公開した `legal/privacy.html` のHTTPS URL |

Appleの定義では、端末から送信され、開発者またはパートナーが要求の処理に必要な期間を超えてアクセスできるデータが収集に当たります。制限対象、日の回数、利用時間、購入状態は端末で処理します。AppleがStoreKitの決済を処理し、開発者が管理する収集先や第三者の解析SDKはありません。

マニフェストのUserDefaults申告は、共有設定のApp Group内利用（1C8F.1）と、アプリ自身の設定（CA92.1）に対応します。レポート拡張はUserDefaultsを使いません。提出時に、最終アーカイブのプライバシーレポートと回答を照合してください。 [AppleのApp Privacyの定義](https://developer.apple.com/app-store/app-privacy-details/)
