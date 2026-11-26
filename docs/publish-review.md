# 公開前の文字列監査

現行の追跡済み53ファイルのうち53ファイルを確認し、認証情報の候補は0件でした。掲載用検索語の旧項目名が過去の公開スキャンで誤検出されています。

50ファイルでは、名前に token、key、secret、password、auth、credential を含む引用符付きの代入を、大文字・小文字を区別せず確認しました。公開スキャナーの別名、既知のトークン形式、秘密鍵の開始行も確認しました。残る3ファイルでは、専門担当がコミット `ca41e851` の原文で同じ語を含む `:` または `=` の行を確認しました。表では7文字以上の値を先頭4文字にマスクしています。

| ファイルと行 | マスク済みの引用 | 判定 |
| --- | --- | --- |
| `docs/app-store/metadata.ja.json:4` | `  "searchTerms": "スクリー…",` | 過去の `keywords` に相当する App Store 掲載用検索語。 |
| `.github/workflows/screenshots.yml:39` | `persist-credentials: false` | チェックアウト時の認証情報の保持を無効にする CI 設定。 |
| `.github/workflows/screenshots.yml:53` | `sorted(devices, key=lamb…)` | Python の並べ替え条件を指定する引数。 |
| `.github/workflows/screenshots.yml:123` | `GH_TOKEN: ${{ …` | GitHub Actions が実行時に渡すシークレットへの参照。 |
| `.github/workflows/screenshots.yml:129` | `auth=$(pr…` | 実行時のトークンから認証ヘッダーの値を作るシェル変数。 |
| `.github/workflows/screenshots.yml:131` | `GIT_CONFIG_KEY_0=http…` | Git の設定項目名。 |
| `.github/workflows/screenshots.yml:132` | `GIT_CONFIG_VALUE_0="AUTH…"` | シェル変数を展開して設定する認証ヘッダー。 |

現行の `searchTerms` は名称の検査条件の外にあります。旧指摘との照合用に記載しています。

`.github/workflows/ios.yml` と `.gitignore` には該当行がありませんでした。
