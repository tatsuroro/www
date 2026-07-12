# tatsuroro.com メディアサイト設計

日付: 2026-07-12
ステータス: レビュー待ち

## 目的

現在の単一プロフィールページを、ブログを中心としたメディアサイトに育てられる構成へ作り直す。

- **ストックコンテンツ**: プロフィール・職務経歴・ポートフォリオ(参考: kawamataryo.github.io/resume)
- **フローコンテンツ**: 技術記事・日記をタイムライン形式で積み上げるブログ(参考: sosukesuzuki.dev)

## 方針(ユーザー要件)

1. シンプルな技術構成。技術的ポータビリティが高く、置き換えが容易であること
2. コンテンツは md / yaml / json の構造化テキストとして保持し、保存・移動がしやすいこと
3. ポートフォリオの更新がしやすいこと。レジュメ系コンテンツの一元管理
4. コンテンツ追加が容易なこと。CMS は作らない。ローカル md + git push で「サッと書ける」体験(理想イメージ: sizu.me)
5. UI の調整がしやすいこと

## 決定事項(ヒアリング結果)

| 論点 | 決定 |
|---|---|
| 執筆フロー | ローカルで md を書き git push → Vercel 自動デプロイ。新規記事の雛形生成コマンドを用意 |
| 既存はてなブログ | 過去記事も移行する(tatsuroro.hateblo.jp) |
| 言語 | 日本語中心。UI ラベルは英語交じり可 |
| 技術構成 | Astro に置き換え(案 A を選択) |
| デザイン方向 | 「B. アクセント演出」— クリーンなベースに控えめな演出 |
| アクセントカラー | 瓶覗(かめのぞき)`#a8deec`。ライトモードの文字アクセントは浅葱系 `#3e8ca6` |

## 技術スタック

- **Astro 5.x + TypeScript**、完全静的出力(`output: 'static'`)
- **コンテンツ管理**: Astro Content Collections(Content Layer API)。frontmatter は Zod スキーマで検証し、不正はビルドエラーで検出
- **スタイル**: プレーン CSS + CSS カスタムプロパティ(デザイントークン)。CSS フレームワークなし。Astro のコンポーネントスコープ CSS を利用
- **付属**: `@astrojs/rss`、`@astrojs/sitemap`、コードハイライトは Astro 内蔵の Shiki
- **デプロイ**: Vercel(現行継続)。push で自動デプロイ
- **クライアント JS**: テーマ切替と演出のみ(数百行以下)。フレームワークランタイムなし

### この構成がポータビリティ要件を満たす理由

- 記事は素の md + frontmatter。他の SSG(Hugo、Eleventy、Next.js 等)へそのまま持ち出せる
- レジュメは JSON Resume 準拠の yaml。他のレジュメツールでも解釈可能
- UI はコンポーネント単位の Astro ファイル + プレーン CSS で、特定 CSS フレームワークへのロックインなし

## ディレクトリ構成

```
src/
  components/          # Header, Footer, PostList, ThemeToggle, GlitchText など
  layouts/             # Base.astro(共通枠), Post.astro(記事用)
  pages/
    index.astro        # トップ
    blog/index.astro   # 記事一覧
    blog/[slug].astro  # 記事詳細
    tags/[tag].astro   # タグ別一覧
    resume.astro       # 職務経歴 + ポートフォリオ
    rss.xml.ts         # RSS フィード
  content/
    blog/              # 記事 md(YYYY-MM-DD-slug.md)
  content.config.ts    # コレクション定義(Zod スキーマ)
  data/
    profile.yaml       # 名前・肩書き・bio・SNS リンク
    resume.yaml        # 職務経歴・スキル(JSON Resume 準拠)
    works.yaml         # ポートフォリオ作品(雛形のみ用意、徐々に埋める)
  styles/
    tokens.css         # デザイントークン(色・字間・余白・フォント)
    global.css         # リセット + ベースタイポグラフィ
  assets/
    blog/<slug>/       # 記事画像(Astro が最適化)
scripts/
  new-post.mjs         # 記事雛形生成
  import-hatena.mjs    # はてなブログ移行(MT 形式 → md)
public/                # favicon 等(現行資産を流用)
docs/superpowers/specs/ # 設計ドキュメント
```

## コンテンツモデル

### ブログ記事(`src/content/blog/*.md`)

ファイル名 = `YYYY-MM-DD-slug.md`。URL は `/blog/YYYY-MM-DD-slug`(ファイル名がそのまま slug。日付込みで衝突せず、一覧性・ソート性が高い)。

```yaml
---
title: 記事タイトル
publishedAt: 2026-07-12
updatedAt: 2026-07-13      # 任意
tags: [astro, blog]         # 任意、デフォルト []
draft: true                 # 任意。true は本番ビルドから除外(ローカルでは表示)
source: hatena              # 任意。はてな移行記事の識別子
---

本文(md)
```

Zod スキーマ(content.config.ts)で上記を強制。`publishedAt` の降順がタイムラインの並び。

### profile.yaml

トップページと共通ヘッダー/フッターの源泉。

```yaml
name: Tatsuro Nakamura
handle: tatsuroro
bio: software developer in Fukuoka, Japan
links:
  - label: GitHub
    url: https://github.com/tatsuroro
  - label: Twitter
    url: https://twitter.com/tatsuroro
  # ...
```

### resume.yaml(JSON Resume 準拠)

[JSON Resume](https://jsonresume.org/schema/) のフィールド名に合わせた yaml。現トップページの Skills / Experience を初期値として移す。

```yaml
basics: { name, label, location, summary }
skills: [{ name, keywords }]
work: [{ name, position, startDate, endDate, summary, highlights }]
```

### works.yaml(ポートフォリオ雛形)

まだ実コンテンツがないため、スキーマとサンプル 1 件(コメントアウト)だけ用意し、`/resume` 内のセクションとして「項目があれば表示、空なら非表示」で実装する。

```yaml
# - title: 作品名
#   description: 説明
#   url: https://...
#   repo: https://github.com/...
#   tech: [TypeScript, Astro]
#   year: 2026
works: []
```

## 画面構成

| パス | 内容 |
|---|---|
| `/` | プロフィール概要(profile.yaml)+ 最新記事 5 件 + 全記事へのリンク |
| `/blog` | 全記事のタイムライン。年ごとにグルーピング |
| `/blog/[slug]` | 記事詳細。タイトル・日付・タグ・本文・前後記事リンク |
| `/tags/[tag]` | タグ別一覧 |
| `/resume` | 職務経歴・スキル(resume.yaml)+ ポートフォリオ(works.yaml、空なら非表示) |
| `/rss.xml` | RSS 2.0 フィード |
| `/sitemap-index.xml` | sitemap(インテグレーション自動生成) |

ヘッダーは全ページ共通: サイト名(グリッチ演出)+ ナビ(blog / resume / tags / rss)+ テーマ切替。

## デザインシステム

### コンセプト

シンプルでスッキリした読み物ベースに、サイバーパンク要素(デジタル・ドット・グリッチ・ブラウン管・ピクセル)を**アクセントとして**添える。演出は「生き物のようなゆらぎ」を持ち、可読性を一切損なわない。

### デザイントークン(tokens.css)

アクセントは「文字用」と「光・面用」の 2 役割に分離する。瓶覗はほぼ白のため、ライトモードでは文字用のみ深い浅葱系に切り替え、瓶覗自体は光・面として両モードに残る。

| トークン | ダーク | ライト |
|---|---|---|
| `--color-bg` | `#0c1219` | `#f8fbfc` |
| `--color-text` | `#cfd6df` | `#3a4552` |
| `--color-text-strong` | `#eef2f6` | `#22303c` |
| `--color-text-muted` | `#77808f` | `#8b96a3` |
| `--color-accent`(文字用) | `#a8deec` 瓶覗 | `#3e8ca6` 浅葱系 |
| `--color-accent-wash`(光・面用) | `#a8deec` 瓶覗 | `#a8deec` 瓶覗 |

面(タグ背景・区切り線・背景の光)は `--color-accent-wash` を透明度違いで使う。ライトの文字アクセントはコントラスト比 AA を満たすことを確認済みの値。

### タイポグラフィ

- 本文: システムフォントスタック(`-apple-system, "Hiragino Sans", sans-serif` 系)。`line-height: 1.9` 前後、日本語の長文が読みやすい余白
- アクセント(サイト名・日付・タグ・コード): 等幅スタック(`"SF Mono", Menlo, monospace` 系)。サイト名は `font-weight: 500` + `letter-spacing: 0.12em`

### 演出インベントリ(承認済みモックアップ準拠)

1. **サイト名の微グリッチ** — ホバー時のみ 0.35 秒、2 フレームの clip-path ずらし
2. **呼吸するカーソル** — サイト名末尾の `▍` が 3.2 秒周期で明滅
3. **背景の光(aura)** — ヘッダー背後に blur した瓶覗の光。11 秒周期でゆっくり漂い、大きさと透明度が揺らぐ(=生き物のゆらぎ)
4. **区切り線の明滅** — アクセントのグラデーション線が 6 秒周期で呼吸
5. **記事タイトルのホバー発光** — 色が瓶覗に変わり淡いグローが付く
6. **ピクセル・リゾルブ** — トップのアバター画像等、限定した 1〜2 箇所で表示時に一瞬モザイク → シャープに解像する演出(「ピクセル解像度の瞬間的な変化」の要素)
7. **`prefers-reduced-motion: reduce`** — 上記 1〜6 の動きをすべて無効化(静的な最終状態で表示)

演出はヘッダー・リンクホバー・区切り・画像表示に限定し、本文領域には持ち込まない。

### ダークモード切替

- `<html data-theme="dark|light">` をトークン切替のフックにする
- 初期値: `localStorage` に保存値があればそれ、なければ `prefers-color-scheme`
- FOUC 防止のため判定スクリプトを `<head>` にインライン
- ヘッダーにトグルボタン(選択は localStorage に保存)

## 執筆フロー

```bash
npm run new "記事タイトル"   # slug を対話で確認し src/content/blog/YYYY-MM-DD-slug.md を生成
npm run dev                  # ローカルプレビュー(保存で即時反映)
git push                     # Vercel が自動デプロイ
```

- 雛形には frontmatter 一式(`draft: true` 付き)が入る。公開時に `draft` を外す
- `draft: true` は本番ビルド(`import.meta.env.PROD`)で除外、dev では表示
- 画像は `src/assets/blog/<slug>/` に置いて相対参照。Astro が最適化する

## はてなブログ移行

1. はてなブログ管理画面から Movable Type 形式でエクスポート(手動、1 回)
2. `node scripts/import-hatena.mjs <export.txt>` で一括変換
   - タイトル・公開日・カテゴリ(→ tags)・本文を md + frontmatter に変換
   - 本文の形式はエクスポートを確認して決める: HTML なら turndown 等で md 化、md ならそのまま、はてな記法なら HTML 経由で変換
   - はてなフォトライフ等の外部画像はダウンロードして `src/assets/blog/` に取り込み、参照を書き換え(外部依存を残さない)
   - 全記事に `source: hatena` を付与
3. 変換結果を目視確認してからコミット(スクリプトは冪等に作る)

旧ブログ側は当面残し、新サイトへの案内を掲示する(リダイレクトははてな側の制約があるため必須としない)。

## テスト・品質保証

- **コンテンツ検証**: Zod スキーマにより frontmatter 不正はビルド失敗として検出(これが実質のコンテンツテスト)
- **型検査**: `astro check`
- **CI**: GitHub Actions で PR ごとに `astro check` + `astro build`(main への push は Vercel が本番ビルド)
- **移行スクリプト**: 変換結果のサンプル記事による手動確認。件数・タイトル一覧の突き合わせ
- ユニットテストフレームワークは導入しない(静的サイトでロジックがほぼないため。YAGNI)

## 実装フェーズ(writing-plans での分解の目安)

1. Astro スキャフォールド + トークン/グローバル CSS + Base レイアウト + ダークモード切替
2. ブログコレクション + 一覧/詳細/タグページ + RSS/sitemap
3. トップページ(profile.yaml)
4. resume ページ(resume.yaml + works.yaml 雛形)
5. 演出(グリッチ・ゆらぎ・ピクセル・reduced-motion 対応)
6. new-post スクリプト + README 更新
7. はてな移行スクリプト + 移行実行
8. 旧 Next.js 資産の撤去、デプロイ確認

## やらないこと(YAGNI)

- CMS・管理画面・Web エディタ
- コメント機能
- サイト内検索(記事が増えたら Pagefind 等を検討)
- i18n(日本語中心と決定。英語プロフィールが必要になったら別途)
- アナリティクス(必要になったら追加)
- OG 画像の自動生成(将来検討。まずは既定の OG メタのみ)
- Astro View Transitions などのページ遷移演出(まずは静的遷移)
