#!/usr/bin/env node
// はてなブログの MT 形式エクスポートを src/content/blog/ の md に変換する。
// 使い方: node scripts/import-hatena.mjs <export.txt> [--download-images]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import TurndownService from 'turndown';
import {
  buildFrontmatter,
  entryFilename,
  extractImageUrls,
  imageLocalName,
  parseMtExport,
} from './lib/mt-parser.mjs';

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

let written = 0;
let imagesDownloaded = 0;
let imagesSkipped = 0;

for (const entry of entries) {
  const isHtml = /<\/?[a-z][^>]*>/i.test(entry.body);
  let body = isHtml ? turndown.turndown(entry.body) : entry.body;

  const images = extractImageUrls(body);
  if (images.length > 0 && downloadImages) {
    const entryId = entryFilename(entry).replace(/\.md$/, '');
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

  await writeFile(path.join(outDir, entryFilename(entry)), buildFrontmatter(entry) + body + '\n');
  written += 1;
}

console.log(`${written} 件を ${outDir}/ に変換しました`);
if (downloadImages) {
  console.log(`画像: ${imagesDownloaded} 件取り込み, ${imagesSkipped} 件スキップ`);
}
console.log('変換結果を確認し、npm run dev で表示を確かめてからコミットしてください。');
