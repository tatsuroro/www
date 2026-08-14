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
