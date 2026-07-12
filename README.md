# tatsuroro.com

[Astro](https://astro.build/) 製の個人サイト。ブログ + プロフィール/レジュメ。

## 開発

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 本番ビルド(dist/)
npm run check    # 型検査
npm run test     # 移行スクリプトのテスト
```

## 記事を書く

```bash
npm run new -- "記事タイトル" my-post-slug
# → src/content/blog/YYYY-MM-DD-my-post-slug.md が draft: true で生成される
npm run dev      # プレビュー(draft も表示される)
# 公開するときは draft: true を削除して push(Vercel が自動デプロイ)
```

## コンテンツの置き場所

| 内容 | ファイル |
|---|---|
| ブログ記事 | `src/content/blog/YYYY-MM-DD-slug.md` |
| プロフィール | `src/data/profile.yaml` |
| 職務経歴・スキル | `src/data/resume.yaml`(JSON Resume 準拠) |
| ポートフォリオ作品 | `src/data/works.yaml` |
| 記事画像 | `src/assets/blog/<slug>/` |

frontmatter は `src/content.config.ts` の Zod スキーマで検証される。

## はてなブログからの移行

```bash
# はてなブログ管理画面 → 設定 → 詳細設定 → エクスポート(MT 形式)
node scripts/import-hatena.mjs export.txt
node scripts/import-hatena.mjs export.txt --download-images
```

## 設計ドキュメント

- 設計: `docs/superpowers/specs/2026-07-12-media-site-design.md`
- 実装計画: `docs/superpowers/plans/2026-07-12-media-site.md`
