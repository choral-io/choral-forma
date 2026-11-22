---
title: "快速开始"
summary: "在本地浏览示例工作区，并将其发布为静态站点。"
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# 快速开始

这个示例工作区位于 `examples/getting-started-workspace`。它围绕一个 `.forma.md` 入口和普通 Markdown 页面组织。

## 启动 WebApp

```sh
cargo run -p forma-cli -- --workspace examples/getting-started-workspace serve
```

在浏览器中打开命令输出的本地 URL。WebApp 使用的就是你可以在编辑器里直接查看的同一组工作区文件。

## 发布静态站点

安装 Forma 后，在仓库根目录运行以下命令。把 `https://example.test` 换成你的站点地址，只填协议和域名。

```sh
forma --workspace examples/getting-started-workspace site build \
  --out dist/getting-started-preview \
  --base-url https://example.test \
  --root-path /preview
```

将 `dist/getting-started-preview` 中的全部内容上传到静态托管服务的 `/preview` 路径。托管服务需要为目录路径提供对应的 `index.html`。如果要发布到站点根路径，省略 `--root-path`，并将产物放到 `/`。

发布后，可以打开以下地址。

| 路径                                          | 打开的内容                         |
| --------------------------------------------- | ---------------------------------- |
| `/preview/notes#start-here`                   | 笔记目录，包含介绍和子文档列表     |
| `/preview/notes/index.md#exact-document-path` | 笔记列表中的一篇普通 Markdown 文档 |
| `/preview/notes/markdown-reader.md#image`     | Markdown 阅读器指南中的图片小节    |
| `/preview/~/spaces/notes`                     | 笔记分类                           |
| `/preview/-/views/guide`                      | 保存的指南视图                     |

[笔记目录](./#start-here)使用 `notes/.index.md` 提供标题、摘要和 Markdown 正文。独占一行的 `<!-- forma:content -->` 注释把子目录和文档列表放在介绍和结尾之间。省略注释时，列表会放在正文末尾。关闭 JavaScript 后，目录列表及其链接仍然可用。打开 [Index Files and Directory Pages](./index.md) 可以体验独立文档地址。

如果旧书签是 `/preview/pages/notes/markdown-reader#image`，请改为 `/preview/notes/markdown-reader.md#image`。迁移时保留部署前缀，以及目标页面仍需使用的查询参数和标题锚点。

## 工作方式

Forma 读取 `.forma.md`，跟随其中的 imports 配置，扫描已配置的 Markdown 文件，并为页面、分类、导航、视图和引用构建读取模型。

getting-started workspace 不使用提交到仓库的持久化索引。本地服务启动时，可以直接从仓库文件重新构建读取模型。

## 先改哪里

先阅读 [[guidelines/workspace-operations|工作区操作指南]]，再尝试修改 [[notes/welcome-to-choral-forma|欢迎使用 Choral Forma]] 的摘要，然后重启本地服务并刷新 WebApp。
