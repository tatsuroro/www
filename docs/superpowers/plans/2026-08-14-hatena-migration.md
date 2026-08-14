# はてなブログ移行と廃止 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 旧はてなブログ `tatsuroro.hateblo.jp` の全 11 記事と画像 3 件を www リポジトリに取り込み、外部依存ゼロの状態で新サイトに反映したうえで、旧ブログとフォトライフ画像を削除する。

**Architecture:** 既存の `scripts/import-hatena.mjs`（MT エクスポート → Markdown 変換 CLI）を改修する。はてな固有 HTML の変換規則は turndown の `addRule` 機構で表現し、責務の異なるモジュール `scripts/lib/hatena-html.mjs` に分離する。`scripts/lib/mt-parser.mjs` は MT 形式のパースに専念させ、slug の決定だけを追加で担う。

**Tech Stack:** Node.js（ESM）/ turndown 7.2.4 / node:test / Astro 7 content collections

**Spec:** `docs/superpowers/specs/2026-08-12-hatena-migration-design.md`

## Global Constraints

- パッケージは ESM（`package.json` の `"type": "module"`）。`import` 構文を使う。
- テストは node:test。`npm test` は `node --test` で、`scripts/lib/*.test.mjs` が拾われる。
- **新規依存を追加しない。** turndown 7.2.4 は既に devDependencies にある。
- 生成する Markdown の frontmatter は `src/content.config.ts` のスキーマに従う。使えるキーは `title` / `publishedAt` / `updatedAt` / `tags` / `draft` / `source` のみで、`source` は `'hatena'` しか受け付けない。スキーマ外のキーを足すとビルドが落ちる。
- コード内のコメントは日本語。既存の `scripts/lib/mt-parser.mjs` と同じ密度・文体に合わせる（何をしているかではなく、なぜそうしているかを書く）。
- 受け入れ基準の grep で `orangeclover.hatenablog.com` は**除外する**。これは本人が張った他者ブログへの引用リンクであり、残すのが正しい。
- 旧ブログの削除（Task 8）は不可逆。Task 7 までの受け入れ基準がすべて通るまで実行しない。

## File Structure

| ファイル | 責務 |
|---|---|
| `scripts/lib/hatena-html.mjs`（新規） | はてな固有 HTML → Markdown。turndown のルール定義のみを持つ |
| `scripts/lib/hatena-html.test.mjs`（新規） | 上記のテスト |
| `scripts/lib/mt-parser.mjs`（改修） | MT 形式のパースと出力ファイル名の決定 |
| `scripts/lib/mt-parser.test.mjs`（改修） | 上記のテスト |
| `scripts/import-hatena.mjs`（改修） | CLI。引数解析と、パース・変換・画像取得の組み立て |
| `archive/hatena/export.txt`（新規） | MT エクスポート原本 |
| `archive/hatena/slug-map.json`（新規） | BASENAME → 英語 slug |
| `src/content/blog/*.md`（生成） | 移行後の記事 11 件 |
| `src/assets/blog/hatena/**`（生成） | 取り込んだ画像 3 件 |

---

### Task 1: はてな固有 HTML の変換モジュール

はてなブログの HTML には、素の turndown に通すと**黙って壊れる**箇所が 2 つある。ブログカードの `<iframe>` は既定ルールが無く子要素も無いため出力がゼロになって消滅し、コードブロックは `<pre class="code">` が `<code>` をネストしないため fenced ルールが発火せずエスケープされたプレーンテキストに落ちる。このタスクはその 4 種類の規則を実装する。

**Files:**
- Create: `scripts/lib/hatena-html.mjs`
- Test: `scripts/lib/hatena-html.test.mjs`

**Interfaces:**
- Consumes: `turndown`（devDependency）
- Produces:
  - `createTurndown(): TurndownService` — はてな用ルールを適用済みのインスタンス
  - `htmlToMarkdown(html: string): string` — 変換のショートカット

- [ ] **Step 1: 失敗するテストを書く**

`scripts/lib/hatena-html.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown } from './hatena-html.mjs';

test('はてなキーワードの自動リンクはテキストだけ残す', () => {
  const html = '<p>アプリの<a class="keyword" href="http://d.hatena.ne.jp/keyword/Rails">Rails</a>を触る</p>';
  assert.equal(htmlToMarkdown(html), 'アプリのRailsを触る');
});

test('class="keyword" の無いリンクは本人が張った引用なので保持する', () => {
  const html = '<p><a href="http://orangeclover.hatenablog.com/entry/1">参考記事</a></p>';
  assert.equal(htmlToMarkdown(html), '[参考記事](http://orangeclover.hatenablog.com/entry/1)');
});

test('ブログカードは iframe の title と デコードした url のリンクになる', () => {
  const html =
    '<p><iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fclubkatsudo.com%2F"' +
    ' title="クラブ活動.com - スケジュール管理" class="embed-card embed-webcard"></iframe>' +
    '<cite class="hatena-citation"><a href="https://clubkatsudo.com/">clubkatsudo.com</a></cite></p>';
  assert.equal(htmlToMarkdown(html), '[クラブ活動.com - スケジュール管理](https://clubkatsudo.com/)');
});

test('ブログカードに title が無ければ url をリンクテキストにする', () => {
  const html =
    '<iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fexample.com%2Fa"></iframe>';
  assert.equal(htmlToMarkdown(html), '[https://example.com/a](https://example.com/a)');
});

test('フォトライフ画像の f:id: な alt / title は落とす', () => {
  const html =
    '<p><img src="https://cdn-ak.f.st-hatena.com/images/fotolife/t/tatsuroro/x/y.png"' +
    ' alt="f:id:tatsuroro:20180911120105p:plain" title="f:id:tatsuroro:20180911120105p:plain"' +
    ' class="hatena-fotolife"></p>';
  assert.equal(
    htmlToMarkdown(html),
    '![](https://cdn-ak.f.st-hatena.com/images/fotolife/t/tatsuroro/x/y.png)',
  );
});

test('f:id: で始まらない alt / title は意味があるので保持する', () => {
  const html = '<p><img src="https://example.com/a.png" alt="設計図" title="全体像"></p>';
  assert.equal(htmlToMarkdown(html), '![設計図](https://example.com/a.png "全体像")');
});

test('pre.code は code をネストしなくても fenced code block になる', () => {
  const html = '<pre class="code" data-lang="" data-unlink>[color &#34;diff&#34;]\n  meta = green</pre>';
  assert.equal(htmlToMarkdown(html), '```\n[color "diff"]\n  meta = green\n```');
});

test('data-lang が非空ならフェンスに言語指定が付く', () => {
  const html = '<pre class="code" data-lang="ruby">puts 1</pre>';
  assert.equal(htmlToMarkdown(html), '```ruby\nputs 1\n```');
});

test('インラインの code はそのままバッククォートになる', () => {
  const html = '<p>設定は <code>~/.gitconfig</code> に書く</p>';
  assert.equal(htmlToMarkdown(html), '設定は `~/.gitconfig` に書く');
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- scripts/lib/hatena-html.test.mjs`
Expected: FAIL。`Cannot find module './hatena-html.mjs'` で全テストが落ちる。

- [ ] **Step 3: 最小の実装を書く**

`scripts/lib/hatena-html.mjs`:

```javascript
// はてなブログの HTML を Markdown に変換する turndown 設定。
// はてな固有のマークアップは素の turndown だと黙って壊れるため、
// ここでルールとして明示的に潰す。
import TurndownService from 'turndown';

const EMBED_PREFIX = 'https://hatenablog-parts.com/embed?url=';

function hasClass(node, name) {
  return (node.getAttribute('class') ?? '').split(/\s+/).includes(name);
}

export function createTurndown() {
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  // はてなキーワードの自動リンクは、はてなが本文に挿し込んだサービス機能であって
  // 筆者が張ったリンクではない。リンク先の d.hatena.ne.jp は既に終了している。
  turndown.addRule('hatenaKeyword', {
    filter: (node) => node.nodeName === 'A' && hasClass(node, 'keyword'),
    replacement: (content) => content,
  });

  // ブログカードの iframe。対になる cite にも実 URL のリンクがあるが、
  // そのテキストはドメイン名だけなので、title を持つ iframe 側を採用する。
  turndown.addRule('hatenaEmbedCard', {
    filter: (node) =>
      node.nodeName === 'IFRAME' && (node.getAttribute('src') ?? '').startsWith(EMBED_PREFIX),
    replacement: (_content, node) => {
      const url = decodeURIComponent(node.getAttribute('src').slice(EMBED_PREFIX.length));
      const title = node.getAttribute('title') || url;
      return `[${title}](${url})`;
    },
  });

  // iframe をリンクにした以上、対の cite を残すと同じリンクが 2 つ並ぶ。
  turndown.addRule('hatenaCitation', {
    filter: (node) => node.nodeName === 'CITE' && hasClass(node, 'hatena-citation'),
    replacement: () => '',
  });

  // フォトライフ画像の alt/title に入る f:id: 形式は内部識別子で、読み手に意味がない。
  turndown.addRule('hatenaImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const src = node.getAttribute('src') ?? '';
      const rawAlt = node.getAttribute('alt') ?? '';
      const rawTitle = node.getAttribute('title') ?? '';
      const alt = rawAlt.startsWith('f:id:') ? '' : rawAlt;
      const title = rawTitle.startsWith('f:id:') ? '' : rawTitle;
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    },
  });

  // はてなのコードブロックは <pre class="code"> で <code> をネストしない。
  // turndown 既定の fenced ルールは pre > code を要求するため発火せず、
  // 中身が通常テキスト扱いになって [ や " がエスケープされてしまう。
  turndown.addRule('hatenaCodeBlock', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const lang = (node.getAttribute('data-lang') ?? '').trim();
      const code = node.textContent.replace(/\n+$/, '');
      return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    },
  });

  return turndown;
}

export function htmlToMarkdown(html) {
  return createTurndown().turndown(html);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- scripts/lib/hatena-html.test.mjs`
Expected: PASS（9 tests）

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/hatena-html.mjs scripts/lib/hatena-html.test.mjs
git commit -m "Add Hatena-specific HTML to Markdown rules"
```

---

### Task 2: slug-map による出力ファイル名の決定

旧 URL は `/entry/2018/08/25/032939` のような時刻値で、読める名前ではない。旧ブログを完全削除する以上 URL 互換を保つ意味がないので、手書きの英語 slug に付け替える。

BASENAME の日付と DATE が食い違う記事が 1 件ある（BASENAME `2018/08/25/032939` に対し DATE は 2017-12-09）。**ファイル名の日付は DATE を正とし、slug-map のキーは BASENAME とする。**

**Files:**
- Modify: `scripts/lib/mt-parser.mjs`（`entryFilename`）
- Test: `scripts/lib/mt-parser.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `entryFilename(entry, slugMap?: Record<string, string>): string` — 第 2 引数は省略可。省略時と未ヒット時は従来の `<date>-hatena-<basename末尾>.md` にフォールバックする。

- [ ] **Step 1: 失敗するテストを書く**

`scripts/lib/mt-parser.test.mjs` の末尾に追記する:

```javascript
// --- slug-map による出力ファイル名 ---

const slugMapSample = `AUTHOR: tatsuroro
TITLE: 日付がずれている記事
BASENAME: 2018/08/25/032939
STATUS: Publish
DATE: 12/09/2017 03:29:39
-----
BODY:
<p>本文</p>
-----
--------
`;

test('slugMap にヒットすると DATE の日付 + slug のファイル名になる', () => {
  const [entry] = parseMtExport(slugMapSample);
  const slugMap = { '2018/08/25/032939': 'frontend-and-what-to-learn' };
  assert.equal(entryFilename(entry, slugMap), '2017-12-09-frontend-and-what-to-learn.md');
});

test('slugMap に無い BASENAME は従来の自動命名にフォールバックする', () => {
  const [entry] = parseMtExport(slugMapSample);
  assert.equal(entryFilename(entry, { '9999/99/99/999999': 'other' }), '2017-12-09-hatena-032939.md');
});

test('slugMap 引数を省略すると従来どおりの自動命名になる', () => {
  const [entry] = parseMtExport(slugMapSample);
  assert.equal(entryFilename(entry), '2017-12-09-hatena-032939.md');
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- scripts/lib/mt-parser.test.mjs`
Expected: FAIL。`slugMap にヒットすると…` が `'2017-12-09-hatena-032939.md' !== '2017-12-09-frontend-and-what-to-learn.md'` で落ちる。他の 2 件は既存実装でも通る。

- [ ] **Step 3: 最小の実装を書く**

`scripts/lib/mt-parser.mjs` の `entryFilename` を置き換える:

```javascript
// BASENAME の日付(URL 由来)と DATE(実際の投稿日)が食い違う記事があるため、
// ファイル名の日付は DATE を正とする。slugMap のキーだけが BASENAME。
export function entryFilename(entry, slugMap = {}) {
  const slug = slugMap[entry.basename];
  if (slug) return `${entry.date}-${slug}.md`;

  const last = entry.basename.split('/').at(-1) || 'entry';
  return `${entry.date}-hatena-${last}.md`;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test -- scripts/lib/mt-parser.test.mjs`
Expected: PASS（既存分を含めて全件）

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/mt-parser.mjs scripts/lib/mt-parser.test.mjs
git commit -m "Support slug map in entry filename"
```

---

### Task 3: 画像 URL 置換の最長一致順ソート

`import-hatena.mjs` は本文中の画像 URL を 1 件ずつ `replaceAll` でローカルパスに置き換える。このとき短い URL が長い URL の接頭辞だと、先に短いほうが置換されて長いほうが壊れる。`extractImageUrls` が長さの降順で返すようにして根本から潰す。

今回の実データ 3 件では顕在化しないが、パーサーの正しさとして直す（spec の改修 3）。

**Files:**
- Modify: `scripts/lib/mt-parser.mjs`（`extractImageUrls`）
- Test: `scripts/lib/mt-parser.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces: `extractImageUrls(body: string): string[]` — 戻り値が**長さの降順**になる（既存の呼び出し側はそのまま動く）

- [ ] **Step 1: 失敗するテストを書く**

`scripts/lib/mt-parser.test.mjs` の末尾に追記する:

```javascript
// --- 置換順序: 短い URL が長い URL の接頭辞であるケース ---

test('extractImageUrls は長さの降順で返す（接頭辞の取り違えを防ぐ）', () => {
  const body = [
    '![a](https://example.com/img.png)',
    '![b](https://example.com/img.png?size=large)',
  ].join(' ');
  assert.deepEqual(extractImageUrls(body), [
    'https://example.com/img.png?size=large',
    'https://example.com/img.png',
  ]);
});

test('順に replaceAll しても短い URL が長い URL を壊さない', () => {
  let body = '![a](https://example.com/img.png) ![b](https://example.com/img.png?size=large)';
  const local = { 'https://example.com/img.png': './img.png', 'https://example.com/img.png?size=large': './img-2.png' };
  for (const url of extractImageUrls(body)) {
    body = body.replaceAll(url, local[url]);
  }
  assert.equal(body, '![a](./img.png) ![b](./img-2.png)');
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npm test -- scripts/lib/mt-parser.test.mjs`
Expected: FAIL。現行は出現順で返すため 1 件目は順序違いで、2 件目は `./img.png?size=large` になって落ちる。

- [ ] **Step 3: 最小の実装を書く**

`scripts/lib/mt-parser.mjs` の `extractImageUrls` を置き換える:

```javascript
// 長さの降順で返す。呼び出し側が順に replaceAll するため、
// 短い URL が長い URL の接頭辞だと先に食われて長いほうが壊れる。
export function extractImageUrls(body) {
  return [...new Set(body.match(IMAGE_URL_PATTERN) ?? [])].sort((a, b) => b.length - a.length);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm test`
Expected: PASS。既存の `extractImageUrls はクエリ文字列を含む…` も長さ順が一致するため通り続ける。

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/mt-parser.mjs scripts/lib/mt-parser.test.mjs
git commit -m "Sort image URLs by length before replacement"
```

---

### Task 4: CLI の統合

`import-hatena.mjs` を、Task 1〜3 の成果を使うように組み立て直す。あわせて引数解析を直す。現行は `args.find((a) => !a.startsWith('--'))` でエクスポートファイルを拾うため、`--slug-map <path>` を足すとその**値のほうがエクスポートファイルとして拾われてしまう**。

**Files:**
- Modify: `scripts/import-hatena.mjs`

**Interfaces:**
- Consumes: `createTurndown()`（Task 1）、`entryFilename(entry, slugMap)`（Task 2）、`extractImageUrls(body)`（Task 3）
- Produces: CLI のみ。他タスクが依存する関数は無い。

- [ ] **Step 1: 引数解析を書き換える**

`scripts/import-hatena.mjs` の先頭から `await mkdir(outDir, ...)` までを、以下で置き換える:

```javascript
#!/usr/bin/env node
// はてなブログの MT 形式エクスポートを src/content/blog/ の md に変換する。
// 使い方: node scripts/import-hatena.mjs <export.txt> [--slug-map <file>] [--download-images]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTurndown } from './lib/hatena-html.mjs';
import {
  buildFrontmatter,
  entryFilename,
  extractImageUrls,
  imageLocalName,
  parseMtExport,
} from './lib/mt-parser.mjs';

const USAGE = 'Usage: node scripts/import-hatena.mjs <export.txt> [--slug-map <file>] [--download-images]';

// オプション値を位置引数と取り違えないよう、手で 1 つずつ読む。
const argv = process.argv.slice(2);
const positional = [];
let downloadImages = false;
let slugMapPath = null;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--download-images') {
    downloadImages = true;
  } else if (arg === '--slug-map') {
    slugMapPath = argv[i + 1];
    if (!slugMapPath || slugMapPath.startsWith('--')) {
      console.error('--slug-map にはファイルパスが必要です');
      process.exit(1);
    }
    i += 1;
  } else if (arg.startsWith('--')) {
    console.error(`不明なオプション: ${arg}\n${USAGE}`);
    process.exit(1);
  } else {
    positional.push(arg);
  }
}

const file = positional[0];
if (!file) {
  console.error(USAGE);
  process.exit(1);
}

const slugMap = slugMapPath ? JSON.parse(await readFile(slugMapPath, 'utf8')) : {};
const turndown = createTurndown();
const text = await readFile(file, 'utf8');
const entries = parseMtExport(text);
const outDir = 'src/content/blog';
const assetRoot = 'src/assets/blog/hatena';
await mkdir(outDir, { recursive: true });
```

- [ ] **Step 2: 変換ループで slugMap を使うようにする**

同ファイルの `for (const entry of entries) {` ブロック内、`const entryId = ...` の行と最後の `writeFile` の行を書き換える。`entryFilename` の呼び出しが 2 箇所あり、**両方に `slugMap` を渡す**必要がある（片方だけだと md のファイル名と画像ディレクトリ名がずれる）。

```javascript
    const entryId = entryFilename(entry, slugMap).replace(/\.md$/, '');
```

```javascript
  await writeFile(path.join(outDir, entryFilename(entry, slugMap)), buildFrontmatter(entry) + body + '\n');
```

- [ ] **Step 3: 未変換のタイトル一覧を出せるようにする**

slug を決めるには先にタイトルを知る必要がある。ループの直前に BASENAME とタイトルの対応を出力する。ファイル末尾の完了メッセージの前に以下を追加する:

```javascript
console.log('\nslug-map 用の BASENAME とタイトル:');
for (const entry of entries) {
  console.log(`  ${JSON.stringify(entry.basename)}: ${JSON.stringify(entry.title)}`);
}
```

- [ ] **Step 4: ヘルプが壊れていないことを確認する**

Run: `node scripts/import-hatena.mjs`
Expected: `Usage: node scripts/import-hatena.mjs <export.txt> [--slug-map <file>] [--download-images]` を表示して exit 1

Run: `node scripts/import-hatena.mjs foo.txt --bogus`
Expected: `不明なオプション: --bogus` を表示して exit 1

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（Task 1〜3 の全テスト）

- [ ] **Step 6: コミット**

```bash
git add scripts/import-hatena.mjs
git commit -m "Wire slug map and Hatena HTML rules into import CLI"
```

---

### Task 5: 原本の保全と移行の実行

ここから生成物を作る。旧ブログの削除は不可逆なので、まず原本をリポジトリに保全する。

**Files:**
- Create: `archive/hatena/export.txt`
- Create: `archive/hatena/slug-map.json`
- Generated: `src/content/blog/*.md`、`src/assets/blog/hatena/**`

- [ ] **Step 1: MT エクスポート原本を保全する**

```bash
mkdir -p archive/hatena
cp ~/Downloads/tatsuroro.hateblo.jp.export.txt archive/hatena/export.txt
```

第三者の個人情報が無いことを確認する（spec で実測済みだが、コミット前に再確認する）:

```bash
grep -cE '^(COMMENT|PING|EMAIL|IP):' archive/hatena/export.txt
```
Expected: `0`

- [ ] **Step 2: 既存のサンプル記事を確認する**

`src/content/blog/` には Astro 構築時のサンプルが 2 件ある。移行記事と混ざるので、生成前に何があるか把握しておく。

Run: `ls src/content/blog/`
Expected: `2026-07-12-draft-sample.md` と `2026-07-12-hello-astro.md` の 2 件。これらは**消さない**（サンプルの扱いは Task 6 で判断する）。

- [ ] **Step 3: slug-map なしで 1 回実行してタイトル一覧を得る**

```bash
node scripts/import-hatena.mjs archive/hatena/export.txt
```

Expected: `11 件を src/content/blog/ に変換しました` と、BASENAME + タイトルの一覧 11 行。

- [ ] **Step 4: 生成物をいったん破棄する**

slug 未確定のファイル名で作られているので消す。**サンプル 2 件を巻き込まないよう、自動命名のパターンにだけ一致させる。**

自動命名は `<date>-hatena-<HHMMSS>.md` で末尾が必ず数字になる。`-hatena-` だけを条件にすると、slug に `hatena` を含む記事（`why-i-chose-hatena-blog` など）を後で誤って消しかねないので、数字まで含めて絞る。

```bash
ls src/content/blog/*-hatena-[0-9]*.md
rm -f src/content/blog/*-hatena-[0-9]*.md
ls src/content/blog/
```
Expected: 1 つ目の `ls` で 11 件、`rm` 後はサンプル 2 件だけが残る。

- [ ] **Step 5: slug-map を作る**

Step 3 で出たタイトルを見て、11 件分の英語 slug を決める。`archive/hatena/slug-map.json` を作成する。キーは BASENAME。

```json
{
  "2018/08/25/000000": "boostnote-vim-key-repeat",
  "2018/08/25/032939": "frontend-and-what-to-learn",
  "2018/08/25/032954": "circleci-2-git-submodule",
  "2018/08/25/033618": "git-diff-color",
  "2018/08/27/021844": "why-i-chose-hatena-blog",
  "2018/08/30/102721": "line-should-build-club-management",
  "2018/09/11/122346": "personal-style-in-the-age-of-ai",
  "2018/09/18/172226": "misc-log-molecular-biology",
  "2018/09/25/160808": "content-disposition-memo",
  "2020/05/14/112654": "sequel-pro-mysql-8-nightly",
  "2021/01/01/000006": "2020-retrospective"
}
```

- [ ] **Step 6: slug-map ありで再実行し、画像も取り込む**

```bash
node scripts/import-hatena.mjs archive/hatena/export.txt \
  --slug-map archive/hatena/slug-map.json \
  --download-images
```

Expected: `11 件を src/content/blog/ に変換しました` と `画像: 3 件取り込み, 0 件スキップ`。

画像 3 件のうち 1 件は `http://lineofficial.blogimg.jp/...` で、外部サイトからの直リンクのため取得に失敗する可能性がある。スキップされた場合は Task 6 の Step 3 で検出されるので、そこで対処する。

- [ ] **Step 7: 生成結果をざっと見る**

```bash
ls src/content/blog/
ls -R src/assets/blog/hatena/
```
Expected: 移行記事 11 件（`2017-12-09-frontend-and-what-to-learn.md` など）と、画像ディレクトリ 2〜3 個。

- [ ] **Step 8: コミット**

```bash
git add archive/ src/content/blog/ src/assets/blog/
git commit -m "Import all Hatena blog entries and images"
```

---

### Task 6: 受け入れ基準の検証

spec の受け入れ基準 1〜7 を機械的に確認する。ここで落ちたら Task 1〜5 に戻る。

**Files:**
- Modify: 検証で問題が見つかった箇所

- [ ] **Step 1: 記事数と draft を確認する**

```bash
ls src/content/blog/*.md | wc -l
grep -l 'source: hatena' src/content/blog/*.md | wc -l
grep -l 'draft: true' src/content/blog/*.md | wc -l
```
Expected: 移行記事 11 件（`source: hatena` が 11）。`draft: true` は移行分 2 件 + 既存サンプル `2026-07-12-draft-sample.md` の 1 件で計 3 件。

- [ ] **Step 2: 外部依存がゼロであることを確認する**

`orangeclover.hatenablog.com` は本人が張った引用リンクなので除外する。

```bash
grep -rnE 'cdn-ak\.f\.st-hatena\.com|d\.hatena\.ne\.jp|hatenablog-parts\.com|hateblo\.jp|lineofficial\.blogimg\.jp' src/content/blog/ | grep -v orangeclover
```
Expected: **出力なし**（該当 0 件）

- [ ] **Step 3: 画像がローカル化されていることを確認する**

```bash
grep -rhoE '!\[[^]]*\]\([^)]*\)' src/content/blog/ | grep hatena
find src/assets/blog/hatena -type f
```
Expected: 画像記法の参照先がすべて `../../assets/blog/hatena/...` の相対パスで、`find` の結果が 3 ファイル。

3 件に満たない場合は Step 6 の取得失敗。失敗した URL を手で `curl -o` して該当ディレクトリに置き、md の参照を書き換える。

- [ ] **Step 4: ブログカードが消滅していないことを確認する**

```bash
grep -rcE '\[.+\]\((https://clubkatsudo\.com/|https://engineering\.linecorp\.com|https://gamebiz\.jp|https://schedule\.line\.me/|https://www\.c-sqr\.net/|https://www\.cinematoday\.jp|https://www\.team-manage\.com/)' src/content/blog/ | grep -v ':0'
```
Expected: 合計 7 件のリンクが存在する。

- [ ] **Step 5: コードブロックが壊れていないことを確認する**

```bash
grep -rhcE '^`{3}' src/content/blog/*.md | paste -sd+ - | bc
grep -rn '\\\[' src/content/blog/
```
Expected: 1 つ目の合計が `6`（3 ブロック分の開始と終了）。2 つ目の grep は**出力なし**（エスケープの混入なし）。

- [ ] **Step 6: テストとビルドを通す**

```bash
npm test
npm run build
```
Expected: どちらも成功。ビルドは Astro の画像最適化が md 内の相対画像参照を解決できることの確認でもある。ここで `Could not find requested image` が出たら、md の相対パスが `src/assets/` の実ファイルとずれている。

- [ ] **Step 7: ローカルで目視確認する**

```bash
npm run dev
```

ブラウザで以下を見る:
- `http://localhost:4321/blog/` に移行記事 9 件が並ぶ（draft 2 件は出ない）
- コードブロックのある記事 3 件で、コードが整形されて表示される
- 画像のある記事で画像が表示される
- ブログカード由来のリンクがテキストリンクとして出ている

- [ ] **Step 8: サンプル記事の扱いを決める**

`2026-07-12-hello-astro.md` と `2026-07-12-draft-sample.md` は Astro 構築時の動作確認用。移行記事が入った今、公開サイトに残すかをユーザーに確認する。**勝手に消さない。**

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "Fix issues found in migration verification"
```

（修正が無ければこの Step はスキップ）

---

### Task 7: 本番反映と tatsuroro.com の切替

spec の Phase 1 の残り（Step 2〜5）と Phase 4。**DNS 操作と Vercel 停止はユーザーの手作業**で、こちらからは実行できない。

- [ ] **Step 1: PR を作ってマージする**

```bash
git push -u origin hatena-migration
gh pr create --title "Import Hatena blog entries and retire old blog" --body "$(cat <<'BODY'
旧はてなブログ tatsuroro.hateblo.jp の全 11 記事（公開 9 / 下書き 2）と画像 3 件を取り込み、外部依存をゼロにした。

- はてなキーワード自動リンク 53 件を除去
- ブログカード iframe 7 件を Markdown リンクに変換
- コードブロック 3 件を fenced code block として復元（素の turndown では壊れる）
- 画像 3 件をローカル化
- MT エクスポート原本を archive/hatena/ に保全

設計: docs/superpowers/specs/2026-08-12-hatena-migration-design.md
計画: docs/superpowers/plans/2026-08-14-hatena-migration.md
BODY
)"
```

CI が通ったらマージする。

- [ ] **Step 2: GitHub Pages にカスタムドメインを設定する（ユーザー操作の可能性あり）**

```bash
gh api repos/tatsuroro/www/pages -X PUT -f cname=tatsuroro.com
```

権限不足で失敗したら、GitHub の Settings → Pages → Custom domain に `tatsuroro.com` を入力してもらう。

- [ ] **Step 3: DNS を切り替える（ユーザー操作）**

Squarespace のドメイン管理画面で、`tatsuroro.com` の DNS を変更する。

| レコード | 現在 | 変更後 |
|---|---|---|
| A（apex） | `216.198.79.1` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`（4 本） |
| CNAME `www` | （Vercel） | `tatsuroro.github.io` |

- [ ] **Step 4: 切替を確認する**

```bash
dig +short tatsuroro.com
curl -sI https://tatsuroro.com | head -3
```
Expected: A レコードが `185.199.*`、レスポンスヘッダの `server` が `GitHub.com`。

DNS 伝播と HTTPS 証明書の発行に時間がかかる。証明書が出るまで `https://` はエラーになることがある。

- [ ] **Step 5: 本番で全記事を目視確認する**

`https://tatsuroro.com/blog/` を開き、移行記事 9 件の本文・画像・コードブロック・リンクを確認する。**これが Task 8 に進む条件。**

- [ ] **Step 6: Vercel プロジェクトを停止する（ユーザー操作）**

Vercel のダッシュボードで www プロジェクトを削除または無効化する。

---

### Task 8: 旧ブログの廃止（ユーザー操作・不可逆）

**Task 7 の Step 5 が完了するまで実行しない。取り消しできない。**

- [ ] **Step 1: 削除前の最終確認**

- `archive/hatena/export.txt` が main にコミットされている
- `https://tatsuroro.com/blog/` で 9 記事すべてが読める
- 画像 3 件が表示される

- [ ] **Step 2: はてなブログを削除する（ユーザー操作）**

はてなブログ管理画面 → 設定 → 基本設定 → 最下部の「ブログを削除する」。

- [ ] **Step 3: はてなフォトライフの画像を削除する（ユーザー操作）**

`https://f.hatena.ne.jp/tatsuroro/` から以下 2 件を削除する。

```
20180911/20180911120105.png
20201231/20201231234714.jpg
```

- [ ] **Step 4: profile.yaml から旧ブログリンクを外す**

`src/data/profile.yaml` の `links` から以下を削除する:

```yaml
  - label: 旧ブログ(はてな)
    url: https://tatsuroro.hateblo.jp/
```

- [ ] **Step 5: 削除されたことを確認する**

```bash
curl -sI https://tatsuroro.hateblo.jp/ | head -1
curl -sI https://cdn-ak.f.st-hatena.com/images/fotolife/t/tatsuroro/20180911/20180911120105.png | head -1
```
Expected: どちらも 404 または 3xx（200 でないこと）

- [ ] **Step 6: コミットして反映する**

```bash
git add src/data/profile.yaml
git commit -m "Drop link to retired Hatena blog"
git push
```

---

## 完了条件

1. `src/content/blog/` に旧ブログの全 11 記事（うち draft 2 件）がある
2. `src/assets/blog/hatena/` に画像 3 件がある
3. 移行記事に `cdn-ak.f.st-hatena.com` / `d.hatena.ne.jp` / `hatenablog-parts.com` / `hateblo.jp` / `lineofficial.blogimg.jp` の参照が 0 件（`orangeclover.hatenablog.com` は除外）
4. ブログカード由来のリンク 7 件が残っている
5. コードブロック 3 件が fenced で、エスケープの混入がない
6. `npm test` と `npm run build` が成功する
7. `https://tatsuroro.com/blog/` で 9 記事が読める
8. `https://tatsuroro.hateblo.jp/` が 200 を返さない
9. `archive/hatena/export.txt` に原本がある
