# アイコン候補プレビュー

AppIcon 候補（A・B・C）を 144px と 60px で並べた比較用 PNG を生成します。

![AppIcon 候補 A・B・C](icon-candidates.png)

## 再生成コマンド

```sh
node tools/preview/render-icon-candidates.mjs
```

- 入力: `docs/icon/candidates/a.svg`, `docs/icon/candidates/b.svg`, `docs/icon/candidates/c.svg`
- 出力: `docs/preview/icon-candidates.png`
- 動作環境: Node.js とローカルの Chrome / Edge（`--headless=new --disable-gpu`、通信なし・追加インストールなし）。別の実行ファイルを使う場合は環境変数 `CHROME_PATH` を指定します。
