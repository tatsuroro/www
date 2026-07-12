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

const now = new Date();
const today = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');
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
