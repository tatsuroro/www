# はてなブログ移行と廃止 設計

2026-08-12（2026-08-14 に MT エクスポート実測にもとづき改訂）

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
| リポジトリ公開状態 | public |

## MT エクスポートの実測（2026-08-14 取得）

`~/Downloads/tatsuroro.hateblo.jp.export.txt`（32KB）を検査した結果:

| 項目 | 実測値 |
|---|---|
| エントリ数 | **11 件**（`STATUS: Publish` 9 件 + `STATUS: Draft` 2 件） |
| BODY の形式 | **すべて HTML**（`<p>` / `<pre class="code">` / `<a href>`）。はてな記法・Markdown ではない |
| `EXTENDED BODY` | 0 件 |
| `COMMENT:` / `PING:` | **0 件** |
| 人物情報 | `AUTHOR: tatsuroro` のみ。第三者のメールアドレス・IP は含まれない |
| `CATEGORY:` | **0 件**（全記事タグなし） |
| 画像 URL | **3 件**（フォトライフ 2 + 外部サイト 1） |
| はてなキーワード自動リンク | **53 件** |
| ブログカード iframe | **7 件** |

公開記事 9 件の BASENAME は、公開ページから取得した URL 一覧と完全一致する。

**注意すべき不整合**: `フロントエンドの適材適所と、エンジニアは何を学ぶべきか` は `BASENAME: 2018/08/25/032939` に対し `DATE: 12/09/2017 03:29:39` で、BASENAME の日付と実際の投稿日が食い違う。出力ファイル名と `publishedAt` は **DATE を正**とし、slug-map のキーは **BASENAME** とする。

### 画像 3 件

```
https://cdn-ak.f.st-hatena.com/images/fotolife/t/tatsuroro/20180911/20180911120105.png
https://cdn-ak.f.st-hatena.com/images/fotolife/t/tatsuroro/20201231/20201231234714.jpg
http://lineofficial.blogimg.jp/ja/imgs/f/d/fde02536-s.png
```

前 2 件がはてなフォトライフ、3 件目は外部サイト（LINE 公式ブログ）からの直リンク。外部依存をゼロにするため 3 件すべてローカルに取り込む。フォトライフ側で削除する対象は前 2 件。

## 決定事項

1. **旧ブログは完全削除する。** はてなブログは無料ドメイン（`hateblo.jp`）のため記事単位の 301 リダイレクトを設定できない。移転告知を残す案・下書き化する案は採らず、ブログごと削除する。既存の被リンク・ブックマーク・検索結果は失われる。取り消し不可。
2. **はてなフォトライフの画像も削除する。** はてなブログを削除してもフォトライフは別サービスとして残るため、取り込みと表示確認の完了後に画像 2 件を削除し、外部依存を完全にゼロにする。
3. **slug は日付 + 手書きの英語 slug とする。** 例 `/blog/2018-08-25-git-diff-color/`。旧 URL を完全削除する以上、時刻値ベースの basename を引き継ぐ価値はない。新規記事（`npm run new`）と命名を揃える。
4. **本文は MT エクスポートの BODY を変換する。** 実測で BODY がすべて HTML であり、画像 URL も実 URL として含まれることを確認したため、公開 HTML を別途取得する経路は不要。
5. **下書き 2 件も移行し、`draft: true` を維持する。** 内容は個人的なメモだが、集約の目的に沿って取り込む。`draft: true` なので新サイトでは非公開のまま。
6. **新サイトの本番化を移行より先に行う。**

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

### Phase 2 — 原本の保全

MT エクスポート原本を `archive/hatena/export.txt` としてコミットする。完全削除は不可逆なため、変換をやり直したくなったときの原本になる。

実測で `COMMENT:` / `PING:` が 0 件、人物情報は `AUTHOR: tatsuroro` のみと確認済みのため、public リポジトリにそのままコミットしてよい。公開 HTML の追加保全は行わない（BODY が完全な HTML を持つため冗長）。

### Phase 3 — 取り込みと整形

MT エクスポートから Markdown を生成し、画像 3 件をローカルに取り込み、はてな固有マークアップを除去し、手書き slug を付与する。ローカルで目視確認する。詳細は後述の「スクリプト設計」。

### Phase 4 — 反映

`hatena-migration` ブランチで PR を作成しマージ。本番で全記事の表示・画像表示を確認する。ここまで完了して初めて削除の条件が揃う。

### Phase 5 — 廃止（ユーザー操作）

1. はてなブログを削除
2. はてなフォトライフの画像 2 件を削除
3. `src/data/profile.yaml` の `旧ブログ(はてな)` リンクを削除

## スクリプト設計

`scripts/import-hatena.mjs` と `scripts/lib/mt-parser.mjs` を改修する。新規スクリプトは作らない。

```
node scripts/import-hatena.mjs archive/hatena/export.txt \
  --slug-map archive/hatena/slug-map.json \
  --download-images
```

### 改修 1: はてな固有マークアップの除去

turndown をかける前に HTML を前処理する。3 種類ある。

**はてなキーワード自動リンク（53 件）** — はてなブログが本文中の単語に自動で付けるリンク。記事の意味ではなくサービス機能であり、リンク先の `d.hatena.ne.jp` は既にサービス終了している。リンクを外してテキストだけ残す。

```html
<a class="keyword" href="http://d.hatena.ne.jp/keyword/Rails">Rails</a>  →  Rails
```

判定は `class="keyword"` を持つ `<a>` に限定する。同じ `d.hatena.ne.jp` でも `class="keyword"` の無いリンクは本人が張った引用リンクなので残す。

**ブログカード iframe（7 件）** — `hatenablog-parts.com` の埋め込みカード。旧ブログ削除後も生きるが外部依存であり、Markdown で表現できない。`src` の `url=` パラメータを URL デコードし、`title` 属性をリンクテキストにして通常のリンクへ変換する。

```html
<iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fclubkatsudo.com%2F"
        title="クラブ活動.com - スケジュール管理 出欠管理 掲示板 無料 グループウェア" ...>
```
↓
```markdown
[クラブ活動.com - スケジュール管理 出欠管理 掲示板 無料 グループウェア](https://clubkatsudo.com/)
```

**フォトライフ画像の alt（2 件）** — `alt="f:id:tatsuroro:20180911120105p:plain"` は内部識別子であり読み手に意味がない。alt を空にする。

### 改修 2: `--slug-map <file>`

`{"2018/08/25/032939": "frontend-and-what-to-learn"}` 形式の JSON。キーは BASENAME、値は英語 slug。

- 出力ファイル名: `src/content/blog/<DATE 由来の日付>-<slug>.md`
- 画像ディレクトリ: `src/assets/blog/hatena/<DATE 由来の日付>-<slug>/`
- 未指定の BASENAME は現行の自動命名（`<date>-hatena-<basename末尾>.md`）にフォールバック

### 改修 3: 画像 URL 置換の最長一致順ソート

既存の fix-later。現行は `extractImageUrls` の返り順に `replaceAll` するため、短い URL が長い URL の接頭辞である場合に置換が壊れる。URL を長さの降順にソートしてから置換する。今回の 3 件では顕在化しないが、パーサーの正しさとして直す。

### 運用手順

1. slug-map なしで 1 回実行し、生成された 11 件のタイトルを確認
2. タイトルを見て 11 件分の英語 slug を決め、`archive/hatena/slug-map.json` を作成
3. 生成物を消して slug-map ありで再実行

## テスト

`scripts/lib/mt-parser.test.mjs` に追加する。node:test を使う既存の方針を踏襲する。

- はてなキーワードリンクの除去（`class="keyword"` あり → 除去、なし → 保持）
- ブログカード iframe → Markdown リンク変換（URL デコードを含む）
- フォトライフ画像の alt 除去
- slug-map 適用時の出力ファイル名（DATE と BASENAME が食い違うケースを含む）
- slug-map 未指定 BASENAME の自動命名フォールバック
- 画像 URL 置換の最長一致順（短い URL が長い URL の接頭辞であるケース）

## 受け入れ基準

1. `src/content/blog/` に旧ブログの全 11 記事が存在し、うち 2 件が `draft: true`
2. `src/assets/blog/hatena/` に画像 3 件が取り込まれている
3. 本文中に以下が **0 件**（外部依存ゼロの証明）
   - `cdn-ak.f.st-hatena.com` — 画像がローカル化されたこと
   - `d.hatena.ne.jp` — キーワードリンクが除去されたこと
   - `hatenablog-parts.com` — ブログカードがリンク化されたこと
   - `hateblo.jp` — 旧ブログ自身への参照が無いこと
   - `lineofficial.blogimg.jp` — 外部画像がローカル化されたこと

   `orangeclover.hatenablog.com` は本人が張った他者ブログへの引用リンクであり、**残してよい**。grep の対象から除外する。
4. `npm test` が成功する
5. `npm run build` が成功する — Astro の画像最適化が md 内の相対画像参照を解決できること
6. 本番 `tatsuroro.com` で公開 9 記事の本文と画像を目視確認できる
7. `archive/hatena/export.txt` に MT エクスポート原本が保全されている

1〜7 をすべて満たしてから Phase 5 の削除に進む。

## スコープ外

- 旧記事の本文の書き直し・加筆（そのまま移行する）
- 旧 URL 構造の再現（`/blog/2018/08/25/032939` 形式のルーティング）
- 公開 HTML の追加保全（MT の BODY が完全な HTML を持つため不要）
- `works.yaml` の記入
