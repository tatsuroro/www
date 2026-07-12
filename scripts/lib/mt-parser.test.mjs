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
