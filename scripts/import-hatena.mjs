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

const USAGE =
  'Usage: node scripts/import-hatena.mjs <export.txt> [--slug-map <file>] [--download-images]';

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

let written = 0;
let imagesDownloaded = 0;
let imagesSkipped = 0;

for (const entry of entries) {
  const isHtml = /<\/?[a-z][^>]*>/i.test(entry.body);
  let body = isHtml ? turndown.turndown(entry.body) : entry.body;

  const images = extractImageUrls(body);
  if (images.length > 0 && downloadImages) {
    const entryId = entryFilename(entry, slugMap).replace(/\.md$/, '');
    const assetDir = path.join(assetRoot, entryId);
    await mkdir(assetDir, { recursive: true });
    const usedNames = new Set();
    for (const url of images) {
      try {
        const name = imageLocalName(url, usedNames);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await writeFile(path.join(assetDir, name), Buffer.from(await res.arrayBuffer()));
        body = body.replaceAll(url, `../../assets/blog/hatena/${entryId}/${name}`);
        imagesDownloaded += 1;
      } catch (err) {
        console.warn(`ダウンロード失敗: ${url} (${err.message})`);
        imagesSkipped += 1;
      }
    }
  } else if (images.length > 0) {
    console.log(`外部画像 ${images.length} 件 (${entry.title}) — --download-images で取り込み`);
  }

  await writeFile(
    path.join(outDir, entryFilename(entry, slugMap)),
    buildFrontmatter(entry) + body + '\n',
  );
  written += 1;
}

console.log(`${written} 件を ${outDir}/ に変換しました`);
if (downloadImages) {
  console.log(`画像: ${imagesDownloaded} 件取り込み, ${imagesSkipped} 件スキップ`);
}

// slug を決めるには先にタイトルを知る必要があるので、
// --slug-map なしで 1 回流したときの下書きとして出しておく。
console.log('\nslug-map 用の BASENAME とタイトル:');
for (const entry of entries) {
  console.log(`  ${JSON.stringify(entry.basename)}: ${JSON.stringify(entry.title)}`);
}

console.log('\n変換結果を確認し、npm run dev で表示を確かめてからコミットしてください。');
