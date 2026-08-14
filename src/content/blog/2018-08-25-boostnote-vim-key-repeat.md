---
title: "Boostnote の Vim keymap 時にキーリピートを有効にする"
publishedAt: 2018-08-25
source: hatena
---
理想のメモアプリを求めてしばらくさまよっていた。Bear みたくクラウドで同期できて、Simplenote みたく無料で使えて、Vim みたく Vim キーバインドで書けるアプリを探してて、もう作ろうかと思っていたら Boostnote に出会った（遅まきながら)

Boostnote、必要な機能がちょうどいい UX で実装されていて、Vim keymap も最高で最高であったが、 Vim keymap 時に `j`, `k` などのキーリピートが効かなかったので、VSCode の設定を流用して解決した。

手元の環境は MacOS High Sierra。

```
defaults write com.maisin.boost ApplePressAndHoldEnabled -bool false
defaults write com.maisin.boost.helper ApplePressAndHoldEnabled -bool false
```

上記設定で `j` `k` などのキーリピートが動くようになる。

余談だけど、 `com.maisin` てなんぞと思ったら開発元の会社名が MAISIN&CO.株式会社 だったのね 福岡本社だし東京オフィスがラトゥール新宿だし（かつて KaizenPlatform も入居していた)、勝手に親近感が沸いた [https://maisin.co/](https://maisin.co/)

Boostnote 良いです。モバイルアプリがこれからなので、コントリビュートしていきたい。
