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
