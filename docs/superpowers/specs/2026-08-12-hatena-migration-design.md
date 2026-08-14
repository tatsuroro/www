# はてなブログ移行と廃止 設計

2026-08-12（2026-08-14 に MT エクスポート実測にもとづき改訂）

## 目的

旧ブログ `https://tatsuroro.hateblo.jp/` の全記事と全画像を www リポジトリに集約し、旧ブログを完全削除する。移行後、旧ブログ関連の外部依存をゼロにする。

## 前提となる現状

| 項目 | 状態 |
|---|---|
| PR #4 `rebuild-with-astro → main` | **2026-08-14 マージ済み**（`264f123`） |
| 配信先 | **Vercel**（2026-08-14 決定。GitHub Pages 案は撤回） |
| `tatsuroro.com` | Vercel が配信。production が main を追えておらず旧 Next.js のままなのが未解決 |
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
| `<pre class="code" data-lang="" data-unlink>` | **3 件**（`<code>` のネストなし、`data-lang` は全て空） |
| `<code>`（インライン） | 6 件 |
| `<h3>` | 13 件 |
| `<blockquote>` | 0 件 |

### 素の turndown にかけた場合の破損（実測）

`turndown@7.2.4` に前処理なしで通したところ、**2 種類の破損**を確認した。どちらも対処必須。

- **ブログカード iframe 7 件が跡形もなく消滅する。** turndown は `<iframe>` に既定ルールを持たず、子要素も無いため出力がゼロになる。ルールを追加しないと、記事から 7 個のリンクが黙って失われる。
- **コードブロック 3 件がプレーンテキストに落ち、しかもエスケープされる。** はてなブログのコードブロックは `<pre class="code">` で `<code>` を**ネストしない**。turndown の fenced code block ルールは `pre > code` を要求するため発火せず、`[color "diff"]` が `\[color \"diff\"\]` になる。技術記事の中身が壊れるため致命的。

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

移行より先に実施し、PR #4 とは別に扱う。デプロイが失敗したときに「配信基盤の設定問題」と「移行した記事の問題」を同時に疑わずに済む。

1. ~~PR #4 をマージ~~ **完了（2026-08-14）**
2. Vercel の production が main を配信するようにする
3. `tatsuroro.com` で表示確認

**2026-08-14: 配信先を GitHub Pages ではなく Vercel に決定した。** 2026-07-14 に「無料運用のため Vercel → GitHub Pages」と決めていたが、GitHub Pages は静的配信しかできず、リダイレクト・ヘッダー制御・将来の動的処理といったサイト改良の余地が無い。ドメインと HTTPS が既に Vercel で動いており、PR ごとのプレビューデプロイも機能しているため、DNS を触らず Vercel に一本化する。

この決定に伴い:

- `.github/workflows/deploy.yml`（GitHub Pages へのデプロイ）を削除する。1 ドメインに 2 つの配信経路があると事故のもとになる。
- GitHub Pages のカスタムドメイン設定（`cname`）は解除済み。
- DNS（Squarespace の A レコード `216.198.79.1`）は**変更しない**。

`astro.config.mjs` は `site: 'https://tatsuroro.com'` で `base` 未設定。Vercel はドメイン直下に配信するためこの設定のままでよい（GitHub Pages のサブパス `tatsuroro.github.io/www/` ではアセットとリンクが壊れるが、その経路は使わない）。

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

`scripts/import-hatena.mjs` と `scripts/lib/mt-parser.mjs` を改修する。新規の CLI スクリプトは作らないが、はてな固有 HTML の変換ルールは責務が異なるため `scripts/lib/hatena-html.mjs` として分離する。`mt-parser.mjs` の責務は MT 形式のパースであり、HTML → Markdown 変換を混ぜない。

```
node scripts/import-hatena.mjs archive/hatena/export.txt \
  --slug-map archive/hatena/slug-map.json \
  --download-images
```

### 改修 1: はてな固有マークアップの処理

turndown の `addRule` で処理する。正規表現による HTML 前処理ではなく turndown のルール機構を使うのは、turndown が内部で DOM を構築しており、属性判定とネスト処理を正しく行えるためである。4 種類ある。

**はてなキーワード自動リンク（53 件）** — はてなブログが本文中の単語に自動で付けるリンク。記事の意味ではなくサービス機能であり、リンク先の `d.hatena.ne.jp` は既にサービス終了している。リンクを外してテキストだけ残す。

```html
<a class="keyword" href="http://d.hatena.ne.jp/keyword/Rails">Rails</a>  →  Rails
```

判定は `class="keyword"` を持つ `<a>` に限定する。同じ `d.hatena.ne.jp` でも `class="keyword"` の無いリンクは本人が張った引用リンクなので残す。

**ブログカード（7 件）** — `hatenablog-parts.com` の埋め込みカード。実際の構造は iframe と `<cite>` の対で、**7 件すべてが対になっている**（iframe 7 / cite 7 / 隣接 7）。

```html
<iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fclubkatsudo.com%2F"
        title="クラブ活動.com - スケジュール管理 出欠管理 掲示板 無料 グループウェア"
        class="embed-card embed-webcard" ...></iframe><cite class="hatena-citation"><a
        href="https://clubkatsudo.com/">clubkatsudo.com</a></cite>
```

`<cite>` 側に実 URL のリンクがあるため iframe を捨てるだけでもリンクは残るが、そのリンクテキストはドメイン名（`clubkatsudo.com`）でしかない。iframe の `title` 属性のほうが情報量が多いので、**iframe を `[title](デコードした url)` に変換し、`<cite>` は除去する**（残すとリンクが重複するため）。

```markdown
[クラブ活動.com - スケジュール管理 出欠管理 掲示板 無料 グループウェア](https://clubkatsudo.com/)
```

**フォトライフ画像の alt / title（2 件）** — `alt="f:id:tatsuroro:20180911120105p:plain"` は内部識別子であり読み手に意味がない。同じ値が `title` 属性にも入っており、素の turndown では `![f:id:...](url "f:id:...")` と 2 箇所に出る。`f:id:` で始まる alt と title の両方を落とし、`![](path)` にする。

**コードブロック `<pre class="code">`（3 件）** — `<code>` をネストしないため turndown の既定ルールが発火せず、中身がエスケープされたプレーンテキストになる。`<pre>` に対するルールを追加し、fenced code block として出力する。`data-lang` 属性が非空ならフェンスの言語指定に使う（実測では 3 件とも空なので言語なしになるが、正しさのため実装する）。

### 旧記事間リンクの書き換えは不要

当初は旧記事同士のリンクを新サイトの相対パスへ置換する改修を予定していたが、エクスポート実測で `tatsuroro.hateblo.jp` への参照が **0 件**であることを確認した。本文中の外部リンクはすべて他サイト宛であり、書き換え対象は存在しない。この改修は実装しない。

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

node:test を使う既存の方針を踏襲する。

`scripts/lib/hatena-html.test.mjs`（新規）:

- はてなキーワードリンクの除去（`class="keyword"` あり → 除去、なし → 保持）
- ブログカード iframe → Markdown リンク変換（URL デコードを含む）と `<cite>` の除去
- フォトライフ画像の alt / title 除去
- `<pre class="code">` の fenced code block 化（エスケープされないこと、`data-lang` 非空なら言語指定が付くこと）

`scripts/lib/mt-parser.test.mjs`（既存に追加）:

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
   - `hateblo.jp` — 旧ブログ自身への参照が無いこと（実測 0 件なので回帰チェック）
   - `lineofficial.blogimg.jp` — 外部画像がローカル化されたこと

   `orangeclover.hatenablog.com` は本人が張った他者ブログへの引用リンクであり、**残してよい**。grep の対象から除外する。
4. ブログカードのリンク 7 件が本文に残っている（消滅していないこと）
5. コードブロック 3 件が fenced code block になっており、`\[` のようなエスケープが混入していないこと
6. `npm test` が成功する
7. `npm run build` が成功する — Astro の画像最適化が md 内の相対画像参照を解決できること
8. 本番 `tatsuroro.com`（Vercel）で公開 9 記事の本文と画像を目視確認できる
9. `archive/hatena/export.txt` に MT エクスポート原本が保全されている

1〜9 をすべて満たしてから Phase 5 の削除に進む。

## スコープ外

- 旧記事の本文の書き直し・加筆（そのまま移行する）
- 旧 URL 構造の再現（`/blog/2018/08/25/032939` 形式のルーティング）
- 公開 HTML の追加保全（MT の BODY が完全な HTML を持つため不要）
- `works.yaml` の記入
