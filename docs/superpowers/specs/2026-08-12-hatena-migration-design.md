# はてなブログ移行と廃止 設計

2026-08-12

## 目的

旧ブログ `https://tatsuroro.hateblo.jp/` の全記事と全画像を www リポジトリに集約し、旧ブログを完全削除する。移行後、旧ブログ関連の外部依存をゼロにする。

## 前提となる現状

| 項目 | 状態 |
|---|---|
| PR #4 `rebuild-with-astro → main` | open、未マージ |
| 新サイトの公開状態 | 未公開。`tatsuroro.com` は今も Vercel の旧 Next.js サイトを配信中 |
| GitHub Pages | `build_type: workflow` で有効化済みだが `status: null`（未ビルド）、`cname` 未設定 |
| `deploy.yml` | `rebuild-with-astro` ブランチにのみ存在。main に無いためデプロイ未発火 |
| 移行スクリプト | `scripts/import-hatena.mjs` と `scripts/lib/mt-parser.mjs` は実装・テスト済み。未実行 |
| `src/assets/blog/hatena/` | 空 |
| DNS | レジストラ Squarespace Domains II LLC、NS `ns-cloud-e{1..4}.googledomains.com`、A レコード `216.198.79.1`（Vercel） |

旧ブログの公開記事は 9 件、最終投稿は 2021-01-01。URL 形式は `/entry/YYYY/MM/DD/HHMMSS`（タイトルスラッグなし）。

```
/entry/2018/08/25/000000
/entry/2018/08/25/032939
/entry/2018/08/25/032954
/entry/2018/08/25/033618
/entry/2018/08/27/021844
/entry/2018/08/30/102721
/entry/2018/09/11/122346
/entry/2020/05/14/112654
/entry/2021/01/01/000006
```

MT エクスポートには下書き記事も含まれるため、実際の移行対象は 9 件以上になりうる。

## 決定事項

1. **旧ブログは完全削除する。** はてなブログは無料ドメイン（`hateblo.jp`）のため記事単位の 301 リダイレクトを設定できない。移転告知を残す案・下書き化する案は採らず、ブログごと削除する。既存の被リンク・ブックマーク・検索結果は失われる。取り消し不可。
2. **はてなフォトライフの画像も削除する。** はてなブログを削除してもフォトライフは別サービスとして残るため、取り込みと表示確認の完了後に画像も削除し、外部依存を完全にゼロにする。
3. **slug は日付 + 手書きの英語 slug とする。** 例 `/blog/2018-08-25-hello-hatena/`。旧 URL を完全削除する以上、時刻値ベースの basename を引き継ぐ価値はない。新規記事（`npm run new`）と命名を揃える。
4. **本文は公開 HTML から取得する。** 詳細は後述。
5. **新サイトの本番化を移行より先に行う。** 詳細は後述。

これは 2026-07-12 の spec（`2026-07-12-media-site-design.md`）にある「旧ブログ側は当面残し、新サイトへの案内を掲示する」を上書きする。

## 全体フロー

不可逆な操作（旧ブログ削除）を最後に置き、その前に「新サイトが本番で全記事を配信できている」ことを実証する。

### Phase 1 — 新サイトの本番化

移行より先に実施し、PR #4 とは別に扱う。デプロイが失敗したときに「Pages の設定問題」と「移行した記事の問題」を同時に疑わずに済む。

1. PR #4 をマージ → main で `deploy.yml` が発火
2. GitHub Pages にカスタムドメイン `tatsuroro.com` を設定
3. Squarespace の DNS を切り替え
   - A レコード: `216.198.79.1` → `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153`
   - `www`: CNAME `tatsuroro.github.io`
4. HTTPS 証明書の発行を待ち、表示確認
5. Vercel プロジェクトを停止

`astro.config.mjs` は `site: 'https://tatsuroro.com'` で `base` 未設定のため、`tatsuroro.github.io/www/` ではアセットとリンクが壊れる。カスタムドメイン設定が実質必須であり、それ以前の確認はローカルの `npm run preview` で行う。

### Phase 2 — 旧ブログの完全アーカイブ

完全削除は不可逆なため、削除前に原本を取り切る。保全先はリポジトリ内 `archive/hatena/`。変換をやり直したくなったときの原本になる。

- `archive/hatena/export.txt` — MT エクスポート原本（ユーザーが管理画面から取得して配置）
- `archive/hatena/html/<YYYY-MM-DD-HHMMSS>.html` — 全公開記事の HTML 丸ごと

画像は Phase 3 で `src/assets/blog/hatena/` に取り込むため、アーカイブ側では複製しない。HTML 内の画像参照は元 URL のまま残す（出所の記録として意味がある）。

**個人情報の確認が必須。** `tatsuroro/www` は public リポジトリであり、MT エクスポートの `COMMENT:` / `PING:` セクションにはコメント投稿者の名前・メールアドレス・IP アドレスが含まれうる。原本をコミットする前に該当セクションの中身を確認する。第三者の個人情報が含まれていた場合は、コミット対象から `COMMENT:` / `PING:` セクションを除去した版を `archive/hatena/export.txt` とし、原本はリポジトリ外（`~/` 配下など）に保管する。公開 HTML 側にもコメント欄が含まれるため、同様に確認する。

### Phase 3 — 取り込みと整形

MT エクスポートと保全した公開 HTML から Markdown を生成し、画像をローカルに取り込み、手書き slug を付与する。ローカルで目視確認する。詳細は後述の「本文の取得方針」「スクリプト設計」。

### Phase 4 — 反映

`hatena-migration` ブランチで PR を作成しマージ。本番で全記事の表示・画像表示を確認する。ここまで完了して初めて削除の条件が揃う。

### Phase 5 — 廃止（ユーザー操作）

1. はてなブログを削除
2. はてなフォトライフの画像を削除（対象一覧は Phase 3 で出力する）
3. `src/data/profile.yaml` の `旧ブログ(はてな)` リンクを削除

## 本文の取得方針

**公開 HTML を主経路とする。**

MT エクスポートの BODY は編集時の生データで出力される。はてなブログの編集モードによって、はてな記法・Markdown・HTML のいずれかであり、事前に確定できない。既存の `import-hatena.mjs` は `/<\/?[a-z][^>]*>/i` で HTML 判定して turndown をかけるため、はてな記法の記事は変換されず生のまま出力される。

一方、公開 HTML は最終レンダリング結果であり、編集モードに依存しない。`[f:id:xxx:image]` のようなフォトライフ埋め込み記法も展開済みの `<img>` になっているため、**画像 URL を取りこぼさない**。これが決定的な利点である。

役割分担:

| 項目 | 取得元 |
|---|---|
| title / publishedAt / tags / draft / basename | MT エクスポート（正） |
| 本文 | 公開 HTML の `.entry-content` を turndown |
| 本文（下書き記事） | MT エクスポートの BODY（公開ページが存在しないため） |

## スクリプト設計

### 新規: `scripts/archive-hatena.mjs`

```
node scripts/archive-hatena.mjs
```

1. `https://tatsuroro.hateblo.jp/archive` から記事 URL 一覧を取得
2. 各記事の HTML を `archive/hatena/html/<YYYY-MM-DD-HHMMSS>.html` に保存
3. 取得件数を標準出力に報告

旧ブログが生きているうちにしか実行できない。

### 改修: `scripts/import-hatena.mjs`

```
node scripts/import-hatena.mjs archive/hatena/export.txt \
  --html-dir archive/hatena/html \
  --slug-map archive/hatena/slug-map.json \
  --download-images
```

追加する 3 点:

1. **`--html-dir <dir>`** — 公開 HTML から本文を取得する。basename の `YYYY/MM/DD/HHMMSS` を `YYYY-MM-DD-HHMMSS.html` に対応づけて読み込み、`.entry-content` を抽出して turndown にかける。該当ファイルが無い記事（下書き）は既存の MT 本文経路にフォールバックする。
2. **`--slug-map <file>`** — `{"2018/08/25/032939": "hello-hatena"}` 形式の JSON。出力ファイル名を `<date>-<slug>.md`、画像ディレクトリを `src/assets/blog/hatena/<date>-<slug>/` にする。未指定の basename は現行の自動命名（`<date>-hatena-<basename末尾>.md`）にフォールバックする。
3. **旧記事間リンクの書き換え** — 本文中の `https://tatsuroro.hateblo.jp/entry/<basename>` を slug-map 経由で `/blog/<date>-<slug>/` に置換する。旧ブログ削除後の 404 を防ぐ。

あわせて既存の fix-later を解消する:

- **画像 URL 置換の最長一致順ソート** — 現行は `extractImageUrls` の返り順に `replaceAll` するため、短い URL が長い URL の接頭辞である場合に置換が壊れる。URL を長さの降順にソートしてから置換する。

### 運用手順

1. slug-map なしで 1 回実行し、記事のタイトル一覧を得る
2. タイトルを見て全記事分の英語 slug を決め、`archive/hatena/slug-map.json` を作成
3. 生成物を消して slug-map ありで再実行

### フォトライフ削除対象の出力

取り込み時にダウンロードした画像の元 URL 一覧を `archive/hatena/images.txt` に出力する。Phase 5 でフォトライフから削除する対象の照合に使う。

## テスト

`scripts/lib/mt-parser.test.mjs` に追加する。node:test を使う既存の方針を踏襲する。

- slug-map 適用時の出力ファイル名
- slug-map 未指定 basename の自動命名フォールバック
- 画像 URL 置換の最長一致順（短い URL が長い URL の接頭辞であるケース）
- 旧記事間リンクの書き換え
- 公開 HTML からの `.entry-content` 抽出

## 受け入れ基準

1. `src/content/blog/` に旧ブログの全記事（公開 9 件 + 下書きがあればその分）が存在する
2. `grep -rE "hateblo\.jp|hatena\.ne\.jp|st-hatena\.com|hatenablog" src/content/blog/` が **0 件** — 外部依存ゼロの証明
3. `npm test` が成功する
4. `npm run build` が成功する — Astro の画像最適化が md 内の相対画像参照を解決できること
5. 本番 `tatsuroro.com` で全記事の本文と画像を目視確認できる
6. `archive/hatena/` に MT エクスポート原本と全公開記事の HTML が保全されている

1〜6 をすべて満たしてから Phase 5 の削除に進む。

## スコープ外

- 旧記事の本文の書き直し・加筆（そのまま移行する）
- 旧 URL 構造の再現（`/blog/2018/08/25/032939` 形式のルーティング）
- `works.yaml` の記入
