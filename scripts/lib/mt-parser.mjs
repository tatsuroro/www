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
