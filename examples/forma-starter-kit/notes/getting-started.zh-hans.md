---
kind: note
title: "快速开始"
summary: "使用 forma serve 运行示例工作区并浏览 WebApp。"
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# 快速开始

这个示例工作区位于 `examples/forma-starter-kit`。它围绕一个 `.forma.yml` 入口和普通 Markdown 页面组织。

## 启动 WebApp

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit serve
```

在浏览器中打开命令输出的本地 URL。WebApp 使用的就是你可以在编辑器里直接查看的同一组工作区文件。

## 工作方式

Forma 读取 `.forma.yml`，跟随其中的 include 配置，扫描已配置的 Markdown 文件，并为页面、分类、导航、视图和引用构建读取模型。

starter 不使用提交到仓库的持久化索引。本地服务启动时，可以直接从仓库文件重新构建读取模型。

## 先改哪里

可以先尝试修改 [[notes/welcome-to-choral-forma|欢迎使用 Choral Forma]] 的摘要，然后重启本地服务并刷新 WebApp。
