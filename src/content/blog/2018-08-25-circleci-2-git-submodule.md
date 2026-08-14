---
title: "Circle CI で Git submodule を Clone する（Circle CI ver.2.0)"
publishedAt: 2018-08-25
source: hatena
---
※ ブログを StaticSite で構築してた時のログをはてなにインポートしたものです

*   ブログでアウトプットする習慣をつくろうと思い、手始めに構成を変えた
*   hugo + Circle CI deploying + firebase hosting にした。身近な良さげな構成に思い切り乗っかった
*   Circle CI が ver.2.0 でとても速くなったと聞いたので試したら、秒速デプロイで最高になった
*   ついでに docker image も作って、あとでデプロイ内容をカスタマイズしやすいようにした
*   ついでに hugo theme もフォークして、自分好みにカスタマイズしたい所存(今後やる)
*   forked theme を blog repository の submodule として配置したら、CI デプロイ時に index.html が生成されなくなり、原因を調べたところ表題の submodule clone が行われてないためにテーマファイルがロードされてなかったのであった

### Circle CI で Git submodule を Clone する

Circle CI v1 では以下とのこと。

[Circle CI で git の submodule を含めてテストをする](http://qiita.com/tbpgr/items/1f2e18954327e38de1de) [Circle CIでgit submoduleをクローンしたい場合](https://project-flora.net/2017/04/10/circle-ci%E3%81%A7git-submodule%E3%82%92%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%B3%E3%81%97%E3%81%9F%E3%81%84%E5%A0%B4%E5%90%88/)

ver.2.0 の場合、checkout にサブコマンド無さそうだったので、以下のように書いて解決した。

```
steps:
  - checkout
  - run: |
      git submodule sync
      git submodule update --init
```

Git submodule 便利。初歩的な穴に落ちて、挙動への理解が深まった。
