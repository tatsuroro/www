// Movable Type エクスポート形式のパーサー。
// エントリは `--------` 行、エントリ内のセクションは `-----` 行で区切られる。
import path from 'node:path';

export function parseMtExport(text) {
  return text
    .split(/^--------$/m)
    .map((block) => block.replace(/^\n+/, ''))
    .filter((block) => block.trim())
    .map(parseEntry);
}

// BODY の後に現れうる、既知の MT セクション見出し(BODY 自身を除く)。
const OTHER_SECTION_KEYWORDS = ['EXTENDED BODY:', 'EXCERPT:', 'KEYWORDS:', 'COMMENT:', 'PING:'];

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

  const bodyIdx = sections.findIndex((s) => s.trim().startsWith('BODY:'));
  if (bodyIdx !== -1) {
    let body = sections[bodyIdx].replace(/^\s*BODY:\n?/, '');
    let extended = '';

    for (let i = bodyIdx + 1; i < sections.length; i += 1) {
      const section = sections[i];
      const trimmed = section.trim();

      // 末尾の空セクションは、最後の実セクションを閉じる ----- の後に
      // 何も無いだけの跡形。本文への連結対象ではない。
      if (i === sections.length - 1 && trimmed === '') break;

      const keyword = OTHER_SECTION_KEYWORDS.find((kw) => trimmed.startsWith(kw));
      if (keyword) {
        if (keyword === 'EXTENDED BODY:') {
          extended = section.replace(/^\s*EXTENDED BODY:\n?/, '').trim();
        }
        // 既知セクションの境界に達したので、以降は本文として扱わない。
        break;
      }

      // ----- 単独行が本文内(Markdown の水平線など)に埋め込まれていた
      // せいで誤って区切られた偽陽性。区切り行を復元して本文に戻す。
      body += '\n-----\n' + section;
    }

    body = body.trim();
    entry.body = extended ? `${body}\n\n${extended}` : body;
  }
  return entry;
}

// 画像 URL(クエリ文字列も含む)を本文から抽出する正規表現。
const IMAGE_URL_PATTERN = /https?:\/\/[^\s")]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s")]*)?/g;

export function extractImageUrls(body) {
  return [...new Set(body.match(IMAGE_URL_PATTERN) ?? [])];
}

export function imageLocalName(url, usedNames) {
  const { pathname } = new URL(url);
  const base = path.basename(pathname);
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);

  let name = base;
  let n = 2;
  while (usedNames.has(name)) {
    name = `${stem}-${n}${ext}`;
    n += 1;
  }
  usedNames.add(name);
  return name;
}

export function parseMtDate(value) {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2}:\d{2}$/);
  if (!m) throw new Error(`MT 形式でない日付: ${value}`);
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// BASENAME の日付(URL 由来)と DATE(実際の投稿日)が食い違う記事があるため、
// ファイル名の日付は DATE を正とする。slugMap のキーだけが BASENAME。
export function entryFilename(entry, slugMap = {}) {
  const slug = slugMap[entry.basename];
  if (slug) return `${entry.date}-${slug}.md`;

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
