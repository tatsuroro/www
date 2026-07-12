# tatsuroro.com メディアサイト実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 単一プロフィールページの Next.js サイトを、ブログ(md)+ プロフィール/レジュメ/ポートフォリオ(yaml)を構造化テキストで管理する Astro 製メディアサイトに置き換える。

**Architecture:** Astro 5 の Content Collections でブログ md を Zod 検証付きで管理し、プロフィール系データは yaml を Vite プラグイン経由で import する。UI はプレーン CSS + デザイントークン(CSS カスタムプロパティ)で構築し、`data-theme` 属性でダーク/ライトを切り替える。すべて静的出力で Vercel にデプロイ。

**Tech Stack:** Astro 5.x / TypeScript / @astrojs/rss / @astrojs/sitemap / @rollup/plugin-yaml / turndown(はてな移行のみ)/ node:test(移行スクリプトのテストのみ)

**Spec:** `docs/superpowers/specs/2026-07-12-media-site-design.md`

## Global Constraints

- Node 22+(ローカルは v24.14.1)、パッケージマネージャは npm
- 実行時注記(2026-07-12): 最新 Astro は 7.0.7。計画中の「Astro 5」表記は「Astro 7」と読み替える(計画で使う API は 7.0.7 に存在することを確認済み)
- 完全静的出力(Astro デフォルトの `output: 'static'`。SSR アダプタを入れない)
- `site: 'https://tatsuroro.com'`
- デザイントークン(spec の値を厳守):
  - ダーク: bg `#0c1219` / text `#cfd6df` / text-strong `#eef2f6` / text-muted `#77808f` / accent `#a8deec` / accent-wash `#a8deec`
  - ライト: bg `#f8fbfc` / text `#3a4552` / text-strong `#22303c` / text-muted `#8b96a3` / accent `#3e8ca6` / accent-wash `#a8deec`
- フォント: 本文 `-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif` / 等幅 `"SF Mono", Menlo, Consolas, monospace`
- 記事ファイル名 = `YYYY-MM-DD-slug.md`、URL = `/blog/<ファイル名から .md を除いたもの>`
- `draft: true` の記事は本番ビルド(`import.meta.env.PROD`)から除外、dev では表示
- すべてのアニメーションは `prefers-reduced-motion: reduce` で無効化
- ユニットテストフレームワークは導入しない。例外は移行スクリプトの `node --test`(Node 標準機能)
- 各コミットのメッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を付ける
- ここに載っていない npm 依存を追加しない

## ファイル構成(最終形)

```
astro.config.mjs             # site / sitemap / yaml プラグイン
tsconfig.json                # astro/tsconfigs/strict
package.json                 # scripts: dev/build/preview/check/new/test
src/
  content.config.ts          # blog コレクション(Zod スキーマ)
  content/blog/*.md          # 記事
  data/{profile,resume,works}.yaml
  lib/posts.ts               # 記事取得・日付整形
  lib/types.ts               # yaml データの型定義
  types/yaml.d.ts            # *.yaml モジュール宣言
  styles/{tokens,global}.css
  layouts/Base.astro
  components/{Header,Footer,ThemeToggle,PostList,PixelImage}.astro
  pages/index.astro
  pages/blog/{index,[slug]}.astro
  pages/tags/{index,[tag]}.astro
  pages/resume.astro
  pages/rss.xml.ts
scripts/
  new-post.mjs               # 記事雛形生成
  import-hatena.mjs          # はてな移行 CLI
  lib/mt-parser.mjs          # MT 形式パーサー(純粋関数)
  lib/mt-parser.test.mjs     # node --test
.github/workflows/ci.yml
```

---

### Task 1: Next.js 撤去と Astro スキャフォールド

**Files:**
- Delete: `pages/`(全体)、`styles/`(全体)、`public/vercel.svg`、`package-lock.json`
- Create: `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`
- Modify: `package.json`(全面書き換え), `.gitignore`

**Interfaces:**
- Produces: `npm run dev / build / check` が動く Astro プロジェクト。以降の全タスクが前提にする。

- [ ] **Step 1: ブランチを切り、旧 Next.js 資産を削除**

```bash
git switch -c rebuild-with-astro
git rm -r pages styles public/vercel.svg
rm -rf node_modules package-lock.json .next
```

- [ ] **Step 2: package.json を書き換え**

`package.json` 全文:

```json
{
  "name": "www",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "new": "node scripts/new-post.mjs",
    "test": "node --test scripts/"
  }
}
```

- [ ] **Step 3: 依存をインストール**

```bash
npm install astro
npm install -D @astrojs/check typescript
```

Expected: `package.json` の dependencies に astro、devDependencies に @astrojs/check と typescript が入る。

- [ ] **Step 4: astro.config.mjs を作成**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tatsuroro.com',
});
```

- [ ] **Step 5: tsconfig.json を作成**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 6: 仮トップページを作成**

`src/pages/index.astro`:

```astro
---
---

<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tatsuroro</title>
  </head>
  <body>
    <h1>tatsuroro</h1>
  </body>
</html>
```

- [ ] **Step 7: .gitignore に Astro 用エントリを追加**

`.gitignore` の `# next.js` セクションの下に追記:

```
# astro
.astro/
dist/
```

- [ ] **Step 8: ビルドが通ることを確認**

```bash
npm run build
```

Expected: エラーなしで完了し、`dist/index.html` が生成される。`ls dist/index.html` で確認。

- [ ] **Step 9: コミット**

```bash
git add -A
git commit -m "Replace Next.js with Astro scaffold"
```

---

### Task 2: デザイントークン + Base レイアウト + ダークモード切替

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/ThemeToggle.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: Task 1 の Astro プロジェクト
- Produces: `Base.astro`(Props: `title?: string; description?: string`。`<slot />` に本文)。全ページがこれで包まれる。トークン変数 `--color-bg/-text/-text-strong/-text-muted/-accent/-accent-wash`、`--font-body/-mono`、`--max-width`。

- [ ] **Step 1: tokens.css を作成**

`src/styles/tokens.css`:

```css
:root {
  --font-body: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  --font-mono: 'SF Mono', Menlo, Consolas, monospace;
  --max-width: 42rem;

  --color-bg: #f8fbfc;
  --color-text: #3a4552;
  --color-text-strong: #22303c;
  --color-text-muted: #8b96a3;
  --color-accent: #3e8ca6;
  --color-accent-wash: #a8deec;
  --aura-opacity: 0.35;
}

:root[data-theme='dark'] {
  --color-bg: #0c1219;
  --color-text: #cfd6df;
  --color-text-strong: #eef2f6;
  --color-text-muted: #77808f;
  --color-accent: #a8deec;
  --aura-opacity: 0.13;
}
```

- [ ] **Step 2: global.css を作成**

`src/styles/global.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
}

html {
  color-scheme: light;
}

html[data-theme='dark'] {
  color-scheme: dark;
}

body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.9;
  background: var(--color-bg);
  color: var(--color-text);
  overflow-x: hidden;
}

a {
  color: var(--color-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

h1,
h2,
h3 {
  color: var(--color-text-strong);
  line-height: 1.5;
}

code,
pre,
time {
  font-family: var(--font-mono);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 3: ThemeToggle.astro を作成**

`src/components/ThemeToggle.astro`:

```astro
<button id="theme-toggle" type="button" aria-label="ライト/ダーク切替">◐</button>

<script>
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
</script>

<style>
  button {
    font-size: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    padding: 0.2rem 0.4rem;
  }

  button:hover {
    color: var(--color-accent);
  }
</style>
```

- [ ] **Step 4: Header.astro を作成(この時点では演出なしの静的版)**

`src/components/Header.astro`:

```astro
---
import ThemeToggle from './ThemeToggle.astro';

const nav = [
  { href: '/blog', label: 'blog' },
  { href: '/resume', label: 'resume' },
  { href: '/tags', label: 'tags' },
  { href: '/rss.xml', label: 'rss' },
];
const current = Astro.url.pathname;
---

<header>
  <div class="masthead">
    <a class="site-name" href="/">tatsuroro</a>
    <ThemeToggle />
  </div>
  <p class="tagline">software developer / fukuoka, jp</p>
  <nav>
    {
      nav.map(({ href, label }) => (
        <a href={href} class:list={{ active: current.startsWith(href) }}>
          {label}
        </a>
      ))
    }
  </nav>
  <div class="rule" aria-hidden="true"></div>
</header>

<style>
  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .site-name {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    color: var(--color-text-strong);
  }

  .site-name:hover {
    text-decoration: none;
  }

  .site-name::after {
    content: '▍';
    color: var(--color-accent);
    margin-left: 2px;
  }

  .tagline {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-top: 0.1rem;
  }

  nav {
    display: flex;
    gap: 1.1rem;
    margin-top: 0.8rem;
    font-size: 0.85rem;
  }

  nav a {
    color: var(--color-text-muted);
  }

  nav a.active,
  nav a:hover {
    color: var(--color-accent);
    text-decoration: none;
  }

  .rule {
    height: 1px;
    margin: 0.9rem 0 2rem;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-accent-wash) 55%, transparent),
      color-mix(in srgb, var(--color-accent-wash) 12%, transparent) 45%,
      transparent 85%
    );
  }
</style>
```

- [ ] **Step 5: Footer.astro を作成**

`src/components/Footer.astro`:

```astro
<footer>
  <p>&copy; tatsuroro.com</p>
</footer>

<style>
  footer {
    margin-top: 4rem;
    padding-top: 1rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }
</style>
```

- [ ] **Step 6: Base.astro を作成**

`src/layouts/Base.astro`(head 内のインラインスクリプトが FOUC 防止のテーマ判定):

```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import '../styles/tokens.css';
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
}

const { title, description = 'software developer in Fukuoka, Japan' } = Astro.props;
const pageTitle = title ? `${title} | tatsuroro` : 'tatsuroro';
---

<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="alternate" type="application/rss+xml" title="tatsuroro" href="/rss.xml" />
    <script is:inline>
      const stored = localStorage.getItem('theme');
      const theme =
        stored === 'dark' || stored === 'light'
          ? stored
          : matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
      document.documentElement.dataset.theme = theme;
    </script>
  </head>
  <body>
    <div class="frame">
      <Header />
      <main><slot /></main>
      <Footer />
    </div>
  </body>
</html>

<style>
  .frame {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 2.5rem 1.25rem 4rem;
  }

  main {
    min-height: 60vh;
  }
</style>
```

- [ ] **Step 7: index.astro を Base 使用に更新**

`src/pages/index.astro` 全文を置き換え:

```astro
---
import Base from '../layouts/Base.astro';
---

<Base>
  <p>準備中</p>
</Base>
```

- [ ] **Step 8: dev サーバーで手動確認**

```bash
npm run dev
```

ブラウザで http://localhost:4321 を開き確認:
- ヘッダー(サイト名 + ▍、tagline、nav、グラデーション区切り線)とフッターが表示される
- ◐ ボタンで背景・文字色が切り替わり、リロード後も保持される
- OS がダークモードなら初回からダークで表示される(FOUC なし)

- [ ] **Step 9: check と build**

```bash
npm run check && npm run build
```

Expected: check は `0 errors`、build は成功。

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "Add design tokens, base layout, and dark mode toggle"
```

---

### Task 3: ブログコレクション + 一覧/詳細ページ

**Files:**
- Create: `src/content.config.ts`, `src/lib/posts.ts`, `src/components/PostList.astro`, `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`, `src/content/blog/2026-07-12-hello-astro.md`, `src/content/blog/2026-07-12-draft-sample.md`

**Interfaces:**
- Consumes: `Base.astro`(Task 2)
- Produces:
  - `getPublishedPosts(): Promise<Post[]>` — PROD では draft 除外、publishedAt 降順。`Post = CollectionEntry<'blog'>`
  - `formatDate(date: Date): string` — `YYYY-MM-DD` 形式
  - `PostList.astro`(Props: `posts: Post[]`)
  - 記事 URL 規約 `/blog/${post.id}`(id はファイル名から拡張子を除いたもの)

- [ ] **Step 1: content.config.ts を作成**

`src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    source: z.enum(['hatena']).optional(),
  }),
});

export const collections = { blog };
```

- [ ] **Step 2: サンプル記事を 2 本作成(公開 1、draft 1)**

`src/content/blog/2026-07-12-hello-astro.md`:

```markdown
---
title: Astro でサイトを作り直した
publishedAt: 2026-07-12
tags: [astro, meta]
---

このサイトを Next.js から Astro で作り直した。

記事は md、プロフィールやレジュメは yaml で管理している。

## コードブロックのテスト

​```ts
const greeting: string = 'hello, astro';
console.log(greeting);
​```
```

(注: 上のコードフェンスの前にあるゼロ幅スペースは外して、通常の ``` で書くこと)

`src/content/blog/2026-07-12-draft-sample.md`:

```markdown
---
title: 下書きサンプル(本番に出ないこと)
publishedAt: 2026-07-12
draft: true
---

この記事は draft なので本番ビルドに含まれない。
```

- [ ] **Step 3: lib/posts.ts を作成**

`src/lib/posts.ts`:

```ts
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return posts.sort(
    (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf(),
  );
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: PostList.astro を作成**

`src/components/PostList.astro`:

```astro
---
import { formatDate, type Post } from '../lib/posts';

interface Props {
  posts: Post[];
}

const { posts } = Astro.props;
---

<ul class="post-list">
  {
    posts.map((post) => (
      <li>
        <time datetime={post.data.publishedAt.toISOString()}>
          {formatDate(post.data.publishedAt)}
        </time>
        <a class="etitle" href={`/blog/${post.id}`}>
          {post.data.title}
        </a>
        {post.data.draft && <span class="draft-badge">draft</span>}
        {post.data.tags.map((tag) => (
          <a class="tag" href={`/tags/${tag}`}>
            {tag}
          </a>
        ))}
      </li>
    ))
  }
</ul>

<style>
  .post-list {
    list-style: none;
    padding: 0;
  }

  li {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  time {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--color-accent) 72%, var(--color-text-muted));
    flex-shrink: 0;
  }

  .etitle {
    color: var(--color-text-strong);
  }

  .etitle:hover {
    color: var(--color-accent);
    text-decoration: none;
  }

  .draft-badge,
  .tag {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    padding: 1px 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .tag {
    color: color-mix(in srgb, var(--color-accent) 85%, var(--color-text-strong));
    background: color-mix(in srgb, var(--color-accent-wash) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent-wash) 30%, transparent);
  }

  .tag:hover {
    text-decoration: none;
    border-color: var(--color-accent);
  }

  .draft-badge {
    color: var(--color-bg);
    background: var(--color-text-muted);
  }
</style>
```

- [ ] **Step 5: 記事一覧ページを作成(年ごとグルーピング)**

`src/pages/blog/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import PostList from '../../components/PostList.astro';
import { getPublishedPosts, type Post } from '../../lib/posts';

const posts = await getPublishedPosts();
const byYear = new Map<number, Post[]>();
for (const post of posts) {
  const year = post.data.publishedAt.getFullYear();
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year)!.push(post);
}
const years = [...byYear.keys()].sort((a, b) => b - a);
---

<Base title="blog">
  <h1>blog</h1>
  {
    years.map((year) => (
      <section>
        <h2 class="year">{year}</h2>
        <PostList posts={byYear.get(year)!} />
      </section>
    ))
  }
</Base>

<style>
  h1 {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    margin-bottom: 1.5rem;
  }

  .year {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 1.5rem 0 0.75rem;
  }
</style>
```

- [ ] **Step 6: 記事詳細ページを作成(前後記事リンク付き)**

`src/pages/blog/[slug].astro`:

```astro
---
import { render } from 'astro:content';
import Base from '../../layouts/Base.astro';
import { formatDate, getPublishedPosts, type Post } from '../../lib/posts';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post, i) => ({
    params: { slug: post.id },
    props: {
      post,
      prev: posts[i + 1] ?? null,
      next: posts[i - 1] ?? null,
    },
  }));
}

interface Props {
  post: Post;
  prev: Post | null;
  next: Post | null;
}

const { post, prev, next } = Astro.props;
const { Content } = await render(post);
---

<Base title={post.data.title}>
  <article>
    <header>
      <h1>{post.data.title}</h1>
      <p class="meta">
        <time datetime={post.data.publishedAt.toISOString()}>
          {formatDate(post.data.publishedAt)}
        </time>
        {post.data.updatedAt && <span>(更新: {formatDate(post.data.updatedAt)})</span>}
        {
          post.data.tags.map((tag) => (
            <a class="tag" href={`/tags/${tag}`}>
              {tag}
            </a>
          ))
        }
      </p>
    </header>
    <div class="body">
      <Content />
    </div>
  </article>
  <nav class="post-nav">
    {prev && <a href={`/blog/${prev.id}`}>← {prev.data.title}</a>}
    {next && <a class="next" href={`/blog/${next.id}`}>{next.data.title} →</a>}
  </nav>
</Base>

<style>
  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.4rem;
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    margin-bottom: 2rem;
  }

  .meta time {
    color: color-mix(in srgb, var(--color-accent) 72%, var(--color-text-muted));
  }

  .tag {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    padding: 1px 7px;
    border-radius: 999px;
    color: color-mix(in srgb, var(--color-accent) 85%, var(--color-text-strong));
    background: color-mix(in srgb, var(--color-accent-wash) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent-wash) 30%, transparent);
  }

  .body :global(h2) {
    font-size: 1.15rem;
    margin: 2rem 0 0.75rem;
  }

  .body :global(h3) {
    font-size: 1rem;
    margin: 1.5rem 0 0.5rem;
  }

  .body :global(p) {
    margin: 0.9rem 0;
  }

  .body :global(ul),
  .body :global(ol) {
    padding-left: 1.4rem;
    margin: 0.9rem 0;
  }

  .body :global(pre) {
    padding: 1rem 1.2rem;
    border-radius: 6px;
    font-size: 0.85rem;
    overflow-x: auto;
    margin: 1.2rem 0;
  }

  .body :global(blockquote) {
    border-left: 2px solid var(--color-accent-wash);
    padding-left: 1rem;
    color: var(--color-text-muted);
    margin: 1.2rem 0;
  }

  .body :global(img) {
    max-width: 100%;
    height: auto;
  }

  .post-nav {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 3rem;
    font-size: 0.85rem;
  }

  .post-nav .next {
    margin-left: auto;
    text-align: right;
  }
</style>
```

- [ ] **Step 7: ビルドして draft 除外を確認**

```bash
npm run build && ls dist/blog/
```

Expected: `2026-07-12-hello-astro` があり、`2026-07-12-draft-sample` が**ない**。`index.html` もある。

- [ ] **Step 8: dev で draft が見えることを確認**

```bash
npm run dev
```

http://localhost:4321/blog に「下書きサンプル」が draft バッジ付きで表示され、http://localhost:4321/blog/2026-07-12-hello-astro で本文・コードハイライト・前後リンクが正しく出ることを確認。

- [ ] **Step 9: check とコミット**

```bash
npm run check
git add -A
git commit -m "Add blog collection with list and detail pages"
```

---

### Task 4: タグページ + RSS + sitemap

**Files:**
- Create: `src/pages/tags/index.astro`, `src/pages/tags/[tag].astro`, `src/pages/rss.xml.ts`
- Modify: `astro.config.mjs`, `package.json`(依存追加)

**Interfaces:**
- Consumes: `getPublishedPosts` / `PostList.astro` / `Base.astro`
- Produces: `/tags`, `/tags/[tag]`, `/rss.xml`, `/sitemap-index.xml`

- [ ] **Step 1: 依存を追加**

```bash
npm install @astrojs/rss @astrojs/sitemap
```

- [ ] **Step 2: astro.config.mjs に sitemap を追加**

`astro.config.mjs` 全文:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tatsuroro.com',
  integrations: [sitemap()],
});
```

- [ ] **Step 3: タグ別一覧ページを作成**

`src/pages/tags/[tag].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import PostList from '../../components/PostList.astro';
import { getPublishedPosts, type Post } from '../../lib/posts';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  const tags = new Set(posts.flatMap((p) => p.data.tags));
  return [...tags].map((tag) => ({
    params: { tag },
    props: { posts: posts.filter((p) => p.data.tags.includes(tag)) },
  }));
}

interface Props {
  posts: Post[];
}

const { tag } = Astro.params;
const { posts } = Astro.props;
---

<Base title={`#${tag}`}>
  <h1>#{tag}</h1>
  <PostList posts={posts} />
</Base>

<style>
  h1 {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    margin-bottom: 1.5rem;
  }
</style>
```

- [ ] **Step 4: タグ一覧ページを作成**

`src/pages/tags/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getPublishedPosts } from '../../lib/posts';

const posts = await getPublishedPosts();
const counts = new Map<string, number>();
for (const post of posts) {
  for (const tag of post.data.tags) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
}
const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
---

<Base title="tags">
  <h1>tags</h1>
  <ul>
    {
      tags.map(([tag, count]) => (
        <li>
          <a href={`/tags/${tag}`}>#{tag}</a>
          <span class="count">({count})</span>
        </li>
      ))
    }
  </ul>
</Base>

<style>
  h1 {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    margin-bottom: 1.5rem;
  }

  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.2rem;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }
</style>
```

- [ ] **Step 5: RSS フィードを作成**

`src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'tatsuroro',
    description: 'software developer in Fukuoka, Japan',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishedAt,
      link: `/blog/${post.id}/`,
    })),
  });
}
```

- [ ] **Step 6: ビルドして成果物を確認**

```bash
npm run build && ls dist/rss.xml dist/sitemap-index.xml dist/tags/
```

Expected: 3 つとも存在。`dist/tags/` に `astro/`・`meta/`(サンプル記事のタグ)と `index.html`。`grep hello-astro dist/rss.xml` で記事が載っていること。

- [ ] **Step 7: check とコミット**

```bash
npm run check
git add -A
git commit -m "Add tag pages, RSS feed, and sitemap"
```

---

### Task 5: profile.yaml + トップページ

**Files:**
- Create: `src/data/profile.yaml`, `src/lib/types.ts`, `src/types/yaml.d.ts`
- Modify: `astro.config.mjs`, `src/pages/index.astro`, `package.json`(依存追加)

**Interfaces:**
- Consumes: `Base.astro`, `PostList.astro`, `getPublishedPosts`
- Produces: `src/lib/types.ts` の `Profile / ProfileLink / Resume / Skill / WorkEntry / Portfolio / PortfolioItem` 型(Task 6 も使用)。yaml import が全プロジェクトで可能になる。

- [ ] **Step 1: yaml プラグインを追加**

```bash
npm install -D @rollup/plugin-yaml
```

`astro.config.mjs` 全文を更新:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  site: 'https://tatsuroro.com',
  integrations: [sitemap()],
  vite: {
    plugins: [yaml()],
  },
});
```

- [ ] **Step 2: yaml モジュール宣言を作成**

`src/types/yaml.d.ts`:

```ts
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
```

- [ ] **Step 3: データ型を定義**

`src/lib/types.ts`:

```ts
export interface ProfileLink {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  links: ProfileLink[];
}

export interface Skill {
  name: string;
  keywords: string[];
}

export interface WorkEntry {
  name: string;
  position?: string;
  startDate: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface Resume {
  basics: {
    name: string;
    label: string;
    location: string;
    summary?: string;
  };
  skills: Skill[];
  work: WorkEntry[];
}

export interface PortfolioItem {
  title: string;
  description: string;
  url?: string;
  repo?: string;
  tech: string[];
  year: number;
}

export interface Portfolio {
  works: PortfolioItem[];
}
```

- [ ] **Step 4: profile.yaml を作成(現トップページの内容を移植)**

`src/data/profile.yaml`:

```yaml
name: Tatsuro Nakamura
handle: tatsuroro
bio: software developer in Fukuoka, Japan
avatar: /android-chrome-192x192.png
links:
  - label: GitHub
    url: https://github.com/tatsuroro
  - label: Twitter
    url: https://twitter.com/tatsuroro
  - label: Facebook
    url: https://www.facebook.com/tatsuro.nk
  - label: 旧ブログ(はてな)
    url: https://tatsuroro.hateblo.jp/
```

- [ ] **Step 5: トップページを本実装に置き換え**

`src/pages/index.astro` 全文:

```astro
---
import Base from '../layouts/Base.astro';
import PostList from '../components/PostList.astro';
import { getPublishedPosts } from '../lib/posts';
import profileData from '../data/profile.yaml';
import type { Profile } from '../lib/types';

const profile = profileData as Profile;
const posts = (await getPublishedPosts()).slice(0, 5);
---

<Base>
  <section class="hero">
    <img src={profile.avatar} alt={profile.name} width="72" height="72" />
    <div>
      <h1>{profile.name}</h1>
      <p class="bio">{profile.bio}</p>
    </div>
  </section>
  <ul class="links">
    {
      profile.links.map((link) => (
        <li>
          <a href={link.url}>{link.label}</a>
        </li>
      ))
    }
  </ul>
  <section class="recent">
    <h2>recent posts</h2>
    <PostList posts={posts} />
    <p class="more"><a href="/blog">すべての記事 →</a></p>
  </section>
</Base>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }

  .hero img {
    border-radius: 50%;
  }

  h1 {
    font-size: 1.3rem;
  }

  .bio {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .links {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
    margin: 1.2rem 0 2.5rem;
    font-size: 0.85rem;
  }

  .recent h2 {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .more {
    font-size: 0.85rem;
    margin-top: 1rem;
  }
</style>
```

- [ ] **Step 6: ビルド確認**

```bash
npm run check && npm run build
```

Expected: エラーなし。`grep "Tatsuro Nakamura" dist/index.html` でプロフィールが出力されている。

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "Add profile.yaml and home page"
```

---

### Task 6: resume.yaml + works.yaml + resume ページ

**Files:**
- Create: `src/data/resume.yaml`, `src/data/works.yaml`, `src/pages/resume.astro`

**Interfaces:**
- Consumes: `Resume` / `Portfolio` 型(Task 5)、`Base.astro`
- Produces: `/resume` ページ。works が空なら Works セクションは出力されない。

- [ ] **Step 1: resume.yaml を作成(現サイトの Skills/Experience を移植)**

`src/data/resume.yaml`:

```yaml
basics:
  name: Tatsuro Nakamura
  label: Software Developer
  location: Fukuoka, Japan
  summary: ''
skills:
  - name: Languages
    keywords: [TypeScript, JavaScript]
  - name: Engineering
    keywords: [Web Frontend Application Structure]
  - name: Design
    keywords: [UI, Interaction design]
  - name: Others
    keywords: [Facilitation, Coaching]
work:
  - name: Ubie, Inc.
    startDate: '2020'
  - name: LINE Growth Technology Corporation
    startDate: '2019'
    endDate: '2020'
  - name: Kaizen Platform, Inc.
    startDate: '2015'
    endDate: '2019'
  - name: CyberAgent, Inc.
    startDate: '2012'
    endDate: '2015'
  - name: Amateur scriptwriter and stage director / Web designer
    startDate: '2005'
    endDate: '2011'
```

- [ ] **Step 2: works.yaml を雛形として作成**

`src/data/works.yaml`:

```yaml
# ポートフォリオ作品。追加するときは以下の形式で works: の下に足す。
# works が空の間、/resume の Works セクションは表示されない。
#
# works:
#   - title: 作品名
#     description: 一行説明
#     url: https://example.com
#     repo: https://github.com/tatsuroro/example
#     tech: [TypeScript, Astro]
#     year: 2026
works: []
```

- [ ] **Step 3: resume ページを作成**

`src/pages/resume.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import resumeData from '../data/resume.yaml';
import worksData from '../data/works.yaml';
import type { Portfolio, Resume } from '../lib/types';

const resume = resumeData as Resume;
const { works } = worksData as Portfolio;

function period(start: string, end?: string): string {
  return end ? `${start} - ${end}` : `${start} -`;
}
---

<Base title="resume">
  <h1>resume</h1>
  <section class="basics">
    <p class="name">{resume.basics.name}</p>
    <p class="label">{resume.basics.label} / {resume.basics.location}</p>
    {resume.basics.summary && <p>{resume.basics.summary}</p>}
  </section>

  <section>
    <h2>Skills</h2>
    <dl>
      {
        resume.skills.map((skill) => (
          <div class="row">
            <dt>{skill.name}</dt>
            <dd>{skill.keywords.join(', ')}</dd>
          </div>
        ))
      }
    </dl>
  </section>

  <section>
    <h2>Experience</h2>
    <ul class="timeline">
      {
        resume.work.map((job) => (
          <li>
            <span class="period">{period(job.startDate, job.endDate)}</span>
            <div>
              <p class="org">{job.name}</p>
              {job.position && <p class="position">{job.position}</p>}
              {job.summary && <p class="summary">{job.summary}</p>}
              {job.highlights && (
                <ul class="highlights">
                  {job.highlights.map((h) => (
                    <li>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))
      }
    </ul>
  </section>

  {
    works.length > 0 && (
      <section>
        <h2>Works</h2>
        <ul class="works">
          {works.map((work) => (
            <li>
              <p class="work-title">
                {work.url ? <a href={work.url}>{work.title}</a> : work.title}
                <span class="year">({work.year})</span>
              </p>
              <p class="summary">{work.description}</p>
              <p class="tech">
                {work.tech.join(' / ')}
                {work.repo && <a href={work.repo}>repo</a>}
              </p>
            </li>
          ))}
        </ul>
      </section>
    )
  }
</Base>

<style>
  h1 {
    font-family: var(--font-mono);
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin: 2rem 0 0.75rem;
  }

  .basics .name {
    font-size: 1.05rem;
    color: var(--color-text-strong);
  }

  .basics .label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  dl {
    margin: 0;
  }

  .row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.4rem;
  }

  dt {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-text-muted);
    min-width: 8.5rem;
    padding-top: 0.15rem;
  }

  dd {
    margin: 0;
    font-size: 0.9rem;
  }

  .timeline,
  .works,
  .highlights {
    list-style: none;
    padding: 0;
  }

  .timeline > li {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

  .period {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: color-mix(in srgb, var(--color-accent) 72%, var(--color-text-muted));
    min-width: 8.5rem;
    padding-top: 0.25rem;
    flex-shrink: 0;
  }

  .org {
    color: var(--color-text-strong);
  }

  .position,
  .summary,
  .tech {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .highlights {
    padding-left: 1.2rem;
    list-style: disc;
    font-size: 0.85rem;
  }

  .works > li {
    margin-bottom: 1.2rem;
  }

  .work-title .year {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-text-muted);
    margin-left: 0.4rem;
  }

  .tech a {
    margin-left: 0.6rem;
  }
</style>
```

- [ ] **Step 4: ビルド確認(Works セクションが出ないこと)**

```bash
npm run check && npm run build
grep -c "Works" dist/resume/index.html || echo "Works なし(期待どおり)"
grep "Ubie" dist/resume/index.html
```

Expected: `Works` は 0 件(works.yaml が空のため)、`Ubie, Inc.` が Experience に出力されている。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "Add resume page with resume.yaml and works.yaml template"
```

---

### Task 7: 演出(グリッチ・ゆらぎ・ピクセルリゾルブ)

**Files:**
- Create: `src/components/PixelImage.astro`
- Modify: `src/components/Header.astro`, `src/components/PostList.astro`, `src/pages/index.astro`

**Interfaces:**
- Consumes: Task 2 の Header / Task 3 の PostList / Task 5 の index
- Produces: `PixelImage.astro`(Props: `src: string; alt: string; width: number; height: number`)— 表示時にモザイク → シャープに解像する丸抜き画像

- [ ] **Step 1: Header に aura・グリッチ・呼吸カーソル・区切り線の明滅を追加**

`src/components/Header.astro` の `<header>` 開始タグ直後に aura を追加:

```astro
<header>
  <div class="aura" aria-hidden="true"></div>
  <div class="masthead">
```

`<style>` を以下の全文に置き換え(既存スタイル + 演出):

```css
  header {
    position: relative;
  }

  .aura {
    position: absolute;
    top: -120px;
    left: -60px;
    width: 380px;
    height: 240px;
    border-radius: 50%;
    background: var(--color-accent-wash);
    filter: blur(60px);
    opacity: var(--aura-opacity);
    animation: drift 11s ease-in-out infinite;
    pointer-events: none;
    z-index: -1;
  }

  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .site-name {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    color: var(--color-text-strong);
    display: inline-block;
  }

  .site-name:hover {
    text-decoration: none;
    animation: glitch 0.35s steps(2, jump-none) 1;
  }

  .site-name::after {
    content: '▍';
    color: var(--color-accent);
    margin-left: 2px;
    animation: breathe 3.2s ease-in-out infinite;
  }

  .tagline {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-top: 0.1rem;
  }

  nav {
    display: flex;
    gap: 1.1rem;
    margin-top: 0.8rem;
    font-size: 0.85rem;
  }

  nav a {
    color: var(--color-text-muted);
  }

  nav a.active,
  nav a:hover {
    color: var(--color-accent);
    text-decoration: none;
  }

  .rule {
    height: 1px;
    margin: 0.9rem 0 2rem;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-accent-wash) 55%, transparent),
      color-mix(in srgb, var(--color-accent-wash) 12%, transparent) 45%,
      transparent 85%
    );
    animation: breathe 6s ease-in-out infinite;
  }

  @keyframes glitch {
    0%,
    100% {
      transform: translate(0, 0);
      clip-path: none;
      opacity: 1;
    }
    25% {
      transform: translate(-1.5px, 0.5px);
      clip-path: inset(15% 0 55% 0);
      opacity: 0.85;
    }
    55% {
      transform: translate(1.5px, -0.5px);
      clip-path: inset(55% 0 15% 0);
      opacity: 0.9;
    }
  }

  @keyframes breathe {
    0%,
    100% {
      opacity: 1;
    }
    45% {
      opacity: 0.3;
    }
    70% {
      opacity: 0.75;
    }
  }

  @keyframes drift {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    40% {
      transform: translate(30px, 12px) scale(1.12);
    }
    75% {
      transform: translate(-12px, 6px) scale(0.95);
    }
  }
```

(注: `.rule` の `@keyframes breathe` は `opacity` を変えるだけなので `--aura-opacity` とは独立。aura 自体の基準透明度はトークンで、明滅は breathe が担う)

- [ ] **Step 2: PostList のタイトルホバーに発光を追加**

`src/components/PostList.astro` の `.etitle:hover` を置き換え:

```css
  .etitle {
    color: var(--color-text-strong);
    transition: color 0.25s, text-shadow 0.25s;
  }

  .etitle:hover {
    color: var(--color-accent);
    text-decoration: none;
    text-shadow: 0 0 14px color-mix(in srgb, var(--color-accent-wash) 45%, transparent);
  }
```

- [ ] **Step 3: PixelImage.astro を作成**

`src/components/PixelImage.astro`:

```astro
---
interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const { src, alt, width, height } = Astro.props;
---

<span class="pixel-resolve">
  <img src={src} alt={alt} width={width} height={height} loading="eager" />
  <canvas width={width} height={height} aria-hidden="true"></canvas>
</span>

<script>
  function resolveSteps(img: HTMLImageElement, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }
    ctx.imageSmoothingEnabled = false;
    const steps = [0.05, 0.1, 0.2, 0.4, 1];
    let i = 0;
    const tick = () => {
      const scale = steps[i]!;
      const w = Math.max(1, Math.round(canvas.width * scale));
      const h = Math.max(1, Math.round(canvas.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.drawImage(canvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
      i += 1;
      if (i < steps.length) {
        setTimeout(tick, 90);
      } else {
        canvas.remove();
      }
    };
    tick();
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const el of document.querySelectorAll<HTMLElement>('.pixel-resolve')) {
    const img = el.querySelector('img');
    const canvas = el.querySelector('canvas');
    if (!img || !canvas) continue;
    if (reduced) {
      canvas.remove();
      continue;
    }
    const start = () => resolveSteps(img, canvas);
    if (img.complete) {
      start();
    } else {
      img.addEventListener('load', start, { once: true });
    }
  }
</script>

<style>
  .pixel-resolve {
    position: relative;
    display: inline-block;
    line-height: 0;
    flex-shrink: 0;
  }

  .pixel-resolve canvas {
    position: absolute;
    inset: 0;
  }

  .pixel-resolve img,
  .pixel-resolve canvas {
    border-radius: 50%;
  }
</style>
```

- [ ] **Step 4: トップページのアバターを PixelImage に置き換え**

`src/pages/index.astro` の frontmatter に import を追加し、hero の `<img ...>` を置き換え:

```astro
import PixelImage from '../components/PixelImage.astro';
```

```astro
  <section class="hero">
    <PixelImage src={profile.avatar} alt={profile.name} width={72} height={72} />
    <div>
      <h1>{profile.name}</h1>
      <p class="bio">{profile.bio}</p>
    </div>
  </section>
```

(`.hero img { border-radius: 50%; }` のルールは PixelImage 側に移ったため削除する)

- [ ] **Step 5: dev で全演出を手動確認**

```bash
npm run dev
```

確認項目:
- ヘッダー背後に水色の光がゆっくり漂う(ライトでは濃く、ダークでは淡く)
- サイト名ホバーで一瞬グリッチ、▍ が呼吸
- 区切り線が 6 秒周期で明滅
- 記事タイトルのホバーで淡く発光
- トップのアバターが一瞬モザイク → シャープに解像
- macOS「視差効果を減らす」を ON にすると(または DevTools の Rendering → prefers-reduced-motion emulate)すべての動きが止まる

- [ ] **Step 6: check・build とコミット**

```bash
npm run check && npm run build
git add -A
git commit -m "Add ambient effects: glitch, aura, breathe, pixel-resolve"
```

---

### Task 8: new-post スクリプト + README 更新

**Files:**
- Create: `scripts/new-post.mjs`
- Modify: `README.md`(全面書き換え)

**Interfaces:**
- Consumes: Task 3 の frontmatter スキーマ
- Produces: `npm run new -- "タイトル" <slug>` で `src/content/blog/YYYY-MM-DD-<slug>.md` を生成

- [ ] **Step 1: new-post.mjs を作成**

`scripts/new-post.mjs`:

```js
#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const [title, slug] = process.argv.slice(2);

if (!title || !slug) {
  console.error('Usage: npm run new -- "記事タイトル" <slug>');
  console.error('例:    npm run new -- "Astro でブログを作り直した" rebuild-with-astro');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`slug は英小文字・数字・ハイフンのみで指定してください: ${slug}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const path = `src/content/blog/${today}-${slug}.md`;

if (existsSync(path)) {
  console.error(`既に存在します: ${path}`);
  process.exit(1);
}

const template = `---
title: ${JSON.stringify(title)}
publishedAt: ${today}
tags: []
draft: true
---

`;

await writeFile(path, template);
console.log(`created: ${path}`);
console.log('公開するときは draft: true の行を削除して git push してください。');
```

- [ ] **Step 2: 動作確認して生成物を消す**

```bash
npm run new -- "テスト記事" test-post
cat "src/content/blog/$(date +%F)-test-post.md"
npm run new -- "テスト記事" test-post; echo "exit: $?"
rm "src/content/blog/$(date +%F)-test-post.md"
npm run new -- "引数不足"; echo "exit: $?"
```

Expected: 1 回目は `created:` が出て frontmatter 付きファイルが生成される。2 回目は「既に存在します」で exit 1。slug なしは Usage 表示で exit 1。

- [ ] **Step 3: README を書き換え**

`README.md` 全文:

```markdown
# tatsuroro.com

[Astro](https://astro.build/) 製の個人サイト。ブログ + プロフィール/レジュメ。

## 開発

​```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 本番ビルド(dist/)
npm run check    # 型検査
npm run test     # 移行スクリプトのテスト
​```

(注: コードフェンスは通常の ``` で書くこと)

## 記事を書く

​```bash
npm run new -- "記事タイトル" my-post-slug
# → src/content/blog/YYYY-MM-DD-my-post-slug.md が draft: true で生成される
npm run dev      # プレビュー(draft も表示される)
# 公開するときは draft: true を削除して push(Vercel が自動デプロイ)
​```

## コンテンツの置き場所

| 内容 | ファイル |
|---|---|
| ブログ記事 | `src/content/blog/YYYY-MM-DD-slug.md` |
| プロフィール | `src/data/profile.yaml` |
| 職務経歴・スキル | `src/data/resume.yaml`(JSON Resume 準拠) |
| ポートフォリオ作品 | `src/data/works.yaml` |
| 記事画像 | `src/assets/blog/<slug>/` |

frontmatter は `src/content.config.ts` の Zod スキーマで検証される。

## はてなブログからの移行

​```bash
# はてなブログ管理画面 → 設定 → 詳細設定 → エクスポート(MT 形式)
node scripts/import-hatena.mjs export.txt
node scripts/import-hatena.mjs export.txt --download-images
​```

## 設計ドキュメント

- 設計: `docs/superpowers/specs/2026-07-12-media-site-design.md`
- 実装計画: `docs/superpowers/plans/2026-07-12-media-site.md`
```

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "Add new-post script and rewrite README"
```

---

### Task 9: はてなブログ移行スクリプト

**Files:**
- Create: `scripts/lib/mt-parser.mjs`, `scripts/lib/mt-parser.test.mjs`, `scripts/import-hatena.mjs`
- Modify: `package.json`(turndown 追加)

**Interfaces:**
- Consumes: Task 3 の frontmatter スキーマ、Task 8 の `npm run test`
- Produces:
  - `parseMtExport(text: string): Entry[]` — `Entry = { title, basename, status, date, categories, body }`(date は `YYYY-MM-DD` 文字列)
  - `entryFilename(entry): string` — `YYYY-MM-DD-hatena-<basename末尾>.md`
  - `buildFrontmatter(entry): string`
  - CLI: `node scripts/import-hatena.mjs <export.txt> [--download-images]`

- [ ] **Step 1: turndown を追加**

```bash
npm install -D turndown
```

- [ ] **Step 2: 失敗するテストを書く**

`scripts/lib/mt-parser.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrontmatter,
  entryFilename,
  parseMtDate,
  parseMtExport,
} from './mt-parser.mjs';

const sample = `AUTHOR: tatsuroro
TITLE: テスト記事
BASENAME: 2020/01/15/123456
STATUS: Publish
DATE: 01/15/2020 12:34:56
CATEGORY: tech
CATEGORY: diary
-----
BODY:
<p>こんにちは<strong>世界</strong></p>
-----
--------
AUTHOR: tatsuroro
TITLE: 下書き記事
BASENAME: 2021/02/03/234567
STATUS: Draft
DATE: 02/03/2021 00:00:00
-----
BODY:
本文だけ
-----
--------
`;

test('parseMtExport は 2 エントリを返す', () => {
  assert.equal(parseMtExport(sample).length, 2);
});

test('メタデータを抽出する', () => {
  const [first] = parseMtExport(sample);
  assert.equal(first.title, 'テスト記事');
  assert.equal(first.date, '2020-01-15');
  assert.deepEqual(first.categories, ['tech', 'diary']);
  assert.equal(first.status, 'Publish');
  assert.equal(first.body, '<p>こんにちは<strong>世界</strong></p>');
});

test('parseMtDate は MM/DD/YYYY を YYYY-MM-DD にする', () => {
  assert.equal(parseMtDate('01/15/2020 12:34:56'), '2020-01-15');
  assert.throws(() => parseMtDate('2020-01-15'));
});

test('entryFilename は日付 + hatena + basename 末尾', () => {
  const [first] = parseMtExport(sample);
  assert.equal(entryFilename(first), '2020-01-15-hatena-123456.md');
});

test('frontmatter に title / publishedAt / tags / source が入る', () => {
  const [first] = parseMtExport(sample);
  const fm = buildFrontmatter(first);
  assert.match(fm, /title: "テスト記事"/);
  assert.match(fm, /publishedAt: 2020-01-15/);
  assert.match(fm, /tags: \["tech", "diary"\]/);
  assert.match(fm, /source: hatena/);
  assert.doesNotMatch(fm, /draft/);
});

test('Draft エントリは draft: true になる', () => {
  const [, second] = parseMtExport(sample);
  assert.match(buildFrontmatter(second), /draft: true/);
});
```

- [ ] **Step 3: テストが失敗することを確認**

```bash
npm run test
```

Expected: FAIL(`Cannot find module ... mt-parser.mjs`)。

- [ ] **Step 4: mt-parser.mjs を実装**

`scripts/lib/mt-parser.mjs`:

```js
// Movable Type エクスポート形式のパーサー。
// エントリは `--------` 行、エントリ内のセクションは `-----` 行で区切られる。

export function parseMtExport(text) {
  return text
    .split(/^--------$/m)
    .map((block) => block.replace(/^\n+/, ''))
    .filter((block) => block.trim())
    .map(parseEntry);
}

function parseEntry(block) {
  const sections = block.split(/^-----$/m);
  const entry = { title: '', basename: '', status: '', date: '', categories: [], body: '' };

  for (const line of sections[0].split('\n')) {
    const m = line.match(/^([A-Z]+): ?(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'TITLE') entry.title = value;
    else if (key === 'BASENAME') entry.basename = value;
    else if (key === 'STATUS') entry.status = value;
    else if (key === 'DATE') entry.date = parseMtDate(value);
    else if (key === 'CATEGORY') entry.categories.push(value);
  }

  const bodySection = sections.find((s) => s.trim().startsWith('BODY:'));
  if (bodySection) {
    entry.body = bodySection.replace(/^\s*BODY:\n?/, '').trim();
  }
  return entry;
}

export function parseMtDate(value) {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2}:\d{2}$/);
  if (!m) throw new Error(`MT 形式でない日付: ${value}`);
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export function entryFilename(entry) {
  const last = entry.basename.split('/').at(-1) || 'entry';
  return `${entry.date}-hatena-${last}.md`;
}

export function buildFrontmatter(entry) {
  const lines = ['---'];
  lines.push(`title: ${JSON.stringify(entry.title)}`);
  lines.push(`publishedAt: ${entry.date}`);
  if (entry.categories.length > 0) {
    lines.push(`tags: [${entry.categories.map((c) => JSON.stringify(c)).join(', ')}]`);
  }
  if (entry.status === 'Draft') {
    lines.push('draft: true');
  }
  lines.push('source: hatena');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
npm run test
```

Expected: PASS(7 tests)。

- [ ] **Step 6: CLI 本体を実装**

`scripts/import-hatena.mjs`:

```js
#!/usr/bin/env node
// はてなブログの MT 形式エクスポートを src/content/blog/ の md に変換する。
// 使い方: node scripts/import-hatena.mjs <export.txt> [--download-images]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import TurndownService from 'turndown';
import { buildFrontmatter, entryFilename, parseMtExport } from './lib/mt-parser.mjs';

const args = process.argv.slice(2);
const downloadImages = args.includes('--download-images');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Usage: node scripts/import-hatena.mjs <export.txt> [--download-images]');
  process.exit(1);
}

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
const text = await readFile(file, 'utf8');
const entries = parseMtExport(text);
const outDir = 'src/content/blog';
const assetRoot = 'src/assets/blog/hatena';
await mkdir(outDir, { recursive: true });

const imageUrlPattern = /https?:\/\/[^\s")]+\.(?:png|jpe?g|gif|webp)/g;
let written = 0;

for (const entry of entries) {
  const isHtml = /<\/?[a-z][^>]*>/i.test(entry.body);
  let body = isHtml ? turndown.turndown(entry.body) : entry.body;

  const images = [...new Set(body.match(imageUrlPattern) ?? [])];
  if (images.length > 0 && downloadImages) {
    const entryId = entryFilename(entry).replace(/\.md$/, '');
    const assetDir = path.join(assetRoot, entryId);
    await mkdir(assetDir, { recursive: true });
    for (const url of images) {
      const name = path.basename(new URL(url).pathname);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ダウンロード失敗 (${res.status}): ${url}`);
        continue;
      }
      await writeFile(path.join(assetDir, name), Buffer.from(await res.arrayBuffer()));
      body = body.replaceAll(url, `../../assets/blog/hatena/${entryId}/${name}`);
    }
  } else if (images.length > 0) {
    console.log(`外部画像 ${images.length} 件 (${entry.title}) — --download-images で取り込み`);
  }

  await writeFile(path.join(outDir, entryFilename(entry)), buildFrontmatter(entry) + body + '\n');
  written += 1;
}

console.log(`${written} 件を ${outDir}/ に変換しました`);
console.log('変換結果を確認し、npm run dev で表示を確かめてからコミットしてください。');
```

- [ ] **Step 7: サンプル入力で end-to-end 確認**

テストの fixture と同じ内容を一時ファイルに書いて実行(スクラッチパッドを使用):

```bash
cat > /private/tmp/claude-501/-Users-tatsuroro-src-github-com-tatsuroro-www/91d5d1a1-bd82-4e66-801d-34fefac5f9da/scratchpad/mt-sample.txt <<'EOF'
AUTHOR: tatsuroro
TITLE: テスト記事
BASENAME: 2020/01/15/123456
STATUS: Publish
DATE: 01/15/2020 12:34:56
CATEGORY: tech
-----
BODY:
<p>こんにちは<strong>世界</strong></p>
-----
--------
EOF
node scripts/import-hatena.mjs /private/tmp/claude-501/-Users-tatsuroro-src-github-com-tatsuroro-www/91d5d1a1-bd82-4e66-801d-34fefac5f9da/scratchpad/mt-sample.txt
cat src/content/blog/2020-01-15-hatena-123456.md
npm run build
rm src/content/blog/2020-01-15-hatena-123456.md
```

Expected: 変換ファイルに `title: "テスト記事"` / `source: hatena` / `こんにちは**世界**` が入り、ビルドも通る(スキーマ適合の確認)。確認後にサンプル生成物は削除する。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "Add Hatena blog import script with MT parser tests"
```

---

### Task 10: CI + 仕上げ

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run check` / `npm run build` / `npm run test`(Task 1, 8, 9)
- Produces: PR と main push で型検査 + テスト + ビルドを検証する CI

- [ ] **Step 1: CI ワークフローを作成**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 2: 全チェックを最終確認**

```bash
npm run check && npm run test && npm run build
```

Expected: すべて成功。

- [ ] **Step 3: コミットして PR を作成**

```bash
git add -A
git commit -m "Add CI workflow"
git push -u origin rebuild-with-astro
gh pr create --title "Rebuild as Astro media site" --body "$(cat <<'EOF'
ブログ中心のメディアサイトへの作り直し。設計: docs/superpowers/specs/2026-07-12-media-site-design.md

- Astro 5 + Content Collections(md 記事、Zod 検証)
- profile/resume/works を yaml で管理、/resume ページ
- ダークモード、瓶覗アクセントのデザイントークン、控えめな演出
- RSS / sitemap / タグページ
- new-post 雛形生成、はてな MT 形式移行スクリプト
- CI(check + test + build)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: デプロイの手動確認(ユーザーと実施)**

コードでは完結しない確認項目。PR 作成後にユーザーへ依頼する:

- Vercel ダッシュボードで Framework Preset が `Astro` として検出されているか(旧 Next.js 設定が残っていたら変更)
- PR の Vercel プレビュー URL で表示・テーマ切替・RSS を確認
- 問題なければ PR をマージし、本番 https://tatsuroro.com を確認

---

## 計画外(このプランではやらないこと)

- **はてな移行の実行** — MT エクスポートファイルの取得はユーザーの手作業。ファイル受領後に `node scripts/import-hatena.mjs export.txt --download-images` を実行し、結果を目視確認してコミットする(スクリプト自体は Task 9 で完成)
- OG 画像自動生成、サイト内検索、i18n、アナリティクス(spec の「やらないこと」参照)
