import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFrontmatter,
  entryFilename,
  extractImageUrls,
  imageLocalName,
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

// --- Finding 1: 本文中の埋め込み ----- 行 / EXTENDED BODY ---

const bodyWithEmbeddedRule = `AUTHOR: tatsuroro
TITLE: 区切り線を含む記事
BASENAME: 2022/03/04/345678
STATUS: Publish
DATE: 03/04/2022 10:00:00
-----
BODY:
前半

-----

後半
-----
--------
`;

test('本文中の埋め込み ----- 行は削られずに保持される', () => {
  const [entry] = parseMtExport(bodyWithEmbeddedRule);
  assert.match(entry.body, /前半/);
  assert.match(entry.body, /後半/);
  assert.match(entry.body, /-----/);
  assert.ok(entry.body.indexOf('前半') < entry.body.indexOf('-----'));
  assert.ok(entry.body.indexOf('-----') < entry.body.indexOf('後半'));
});

const extendedBodySample = `AUTHOR: tatsuroro
TITLE: 続きを読む記事
BASENAME: 2022/05/06/456789
STATUS: Publish
DATE: 05/06/2022 09:00:00
-----
BODY:
本文冒頭
-----
EXTENDED BODY:
続きの本文
-----
--------
`;

test('EXTENDED BODY は本文に \\n\\n で連結される', () => {
  const [entry] = parseMtExport(extendedBodySample);
  assert.equal(entry.body, '本文冒頭\n\n続きの本文');
});

// --- Finding 2: 画像 URL 抽出・ローカルファイル名 ---

test('extractImageUrls はクエリ文字列を含む画像 URL を重複なく抽出する', () => {
  const body = [
    '![img](https://example.com/a/foo.png?w=600)',
    '![img2](https://example.com/a/foo.png?w=600)',
    '![img3](https://example.com/b/bar.jpg)',
  ].join(' ');
  assert.deepEqual(extractImageUrls(body), [
    'https://example.com/a/foo.png?w=600',
    'https://example.com/b/bar.jpg',
  ]);
});

test('imageLocalName は basename を返し、クエリ文字列を除く', () => {
  const used = new Set();
  const name = imageLocalName('https://example.com/a/foo.png?w=600', used);
  assert.equal(name, 'foo.png');
  assert.ok(used.has('foo.png'));
});

test('imageLocalName は basename が衝突すると -2, -3 を付与する', () => {
  const used = new Set();
  const first = imageLocalName('https://example.com/a/foo.png', used);
  const second = imageLocalName('https://example.com/b/foo.png', used);
  const third = imageLocalName('https://example.com/c/foo.png', used);
  assert.equal(first, 'foo.png');
  assert.equal(second, 'foo-2.png');
  assert.equal(third, 'foo-3.png');
});
