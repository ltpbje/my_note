---
name: 笔记转个人博客（Hexo + Cloudflare Pages 全免费方案）
overview: 在不破坏现有 Typora 笔记的前提下，用 Hexo 搭建博客型站点，自动去重、补 frontmatter、把失效的 OSS 图片链接替换为仓库内本地图片，通过 Cloudflare Pages 原生 Git 集成免费部署，所有前端资源按国内稳定访问选型。
design:
  architecture:
    framework: html
  styleKeywords:
    - 博客型
    - 极简清爽
    - 卡片式布局
    - 代码友好
    - 深色模式
    - 微动效
    - 响应式
  fontSystem:
    fontFamily: 思源黑体
    heading:
      size: 30px
      weight: 700
    subheading:
      size: 19px
      weight: 600
    body:
      size: 16px
      weight: 400
  colorSystem:
    primary:
      - "#4F46E5"
      - "#6366F1"
      - "#818CF8"
    background:
      - "#FFFFFF"
      - "#F8FAFC"
      - "#0F172A"
    text:
      - "#1E293B"
      - "#475569"
      - "#FFFFFF"
    functional:
      - "#10B981"
      - "#F59E0B"
      - "#EF4444"
      - "#4F46E5"
todos:
  - id: init-hexo-site
    content: 用 hexo init 在 blog/ 建站，配置 root、依赖与 gitignore
    status: completed
  - id: build-prepare-script
    content: 编写 prepare.js：去重筛选、补 frontmatter、重写图片并复制本地图
    status: completed
    dependencies:
      - init-hexo-site
  - id: build-theme-pages
    content: 配置 Butterfly 主题：首页列表、标签、分类、归档、深色模式，资源本地化
    status: completed
    dependencies:
      - init-hexo-site
  - id: add-selfcheck
    content: 编写 check.js：断言无 OSS 残留且图片齐全，输出缺失清单
    status: completed
    dependencies:
      - build-prepare-script
  - id: write-readme-verify
    content: 编写 README，本地构建验证并整理 Cloudflare Pages 上线步骤
    status: completed
    dependencies:
      - build-theme-pages
      - add-selfcheck
---

## 产品概述

把当前 Typora 笔记仓库改造成一个可上线的个人博客，风格为博客型（首页文章列表、时间线、标签、分类），全部采用完全免费的方案，不购买域名、不使用付费图床。部署改用免费的 Cloudflare Pages，所有技术与资源以国内稳定访问为准。

## 核心功能

- 博客型首页：文章卡片列表、最新文章、标签云、分类、归档时间线，支持深色模式
- 只发布去重后的主笔记，跳过 `_local`、`(copy)`、`副本` 等重复文件以及 MCP 项目运行产物
- 图片全部本地化：把已失效的阿里云 OSS 外链替换为仓库内已有的本地图片，第三方外链图片尽量下载到本地，失败则移除并记录清单
- 自动生成文章信息（标题、日期、分类、标签），让博客能正确组织和索引文章
- 原始笔记不改动、不移动，仍可用 Typora 正常编辑
- 通过 Cloudflare Pages 原生 Git 集成免费部署，推送代码到 main 分支即自动构建上线，访问地址形如 `https://my-note.pages.dev`
- 构建自检：确认生成的站点中无残留 OSS 链接、引用的图片文件全部存在
- 前端资源国内友好：主题所需样式与脚本优先随站点本地发布，字体使用系统字体栈，不依赖海外 CDN

## 技术栈选型

- 静态博客引擎：Hexo（Node.js），本地与 Cloudflare Pages 构建均固定 Node 20
- 主题：免费开源中文友好的 `hexo-theme-butterfly`，自带首页卡片列表、标签页、分类页、归档页、深色模式、代码高亮、图片灯箱，通过 npm 依赖安装
- 部署：Cloudflare Pages 原生 Git 集成（连接 GitHub 仓库 `ltpbje/my_note`），无需 GitHub Actions、无需额外令牌
- Root directory：`blog`
- Build command：`npm ci && npm run prepare && npm run check && npx hexo generate`
- Build output：`public`
- 环境变量：`NODE_VERSION=20`
- 站点根路径 `/`，访问地址由 Cloudflare 项目名决定，形如 `https://my-note.pages.dev`，不启用自定义域名
- 构建脚本只用 Node 内置模块 `fs` / `path` / `crypto`，自检用 `assert`，不引入测试框架
- 国内稳定策略：中文字体使用系统字体栈（Noto Sans SC / PingFang SC / Microsoft YaHei），不从 Google Fonts 加载；主题 JS/CSS 优先复制到站点随产物发布，无法本地化的第三方库改走 `https://registry.npmmirror.com`

## 实现方案

采用「构建期生成」策略：保留原笔记为唯一真实来源，用 `prepare.js` 在构建时完成四件事——筛选去重主笔记、补充文章信息、把 OSS/本地/第三方图片链接统一重写为站内路径、仅复制被引用的本地图片到 `blog/source/images`。Hexo 编译为静态站后由 Cloudflare Pages 发布。

关键决策与取舍：

- 主笔记的 OSS 图片实测已返回 404，无法下载；对每个主题优先选用其「本地图片版兄弟文件」作为内容源（正文基本一致），既满足「发布正式版」又天然获得可用图片。无兄弟文件的个别笔记按图片 alt 文本匹配 `Typora-image` 等同名本地图片，无 alt 的降级移除并记录清单。
- 图片只在构建期复制且被 gitignore，原始图片在仓库中仅存一份，仓库维持约 410MB，规避体积翻倍。
- 文章用 ASCII 文件名生成稳定短链，中文标题放 frontmatter，避免中文目录 URL 编码问题。
- `check.js` 串联在 `hexo generate` 之前，发现缺失图片或残留 OSS 链接直接让 Cloudflare 构建失败，防止静默产出坏站。
- 部署选 Cloudflare Pages 原生 Git 集成而非 GitHub Actions：少一个 workflow 文件与一套令牌配置，符合用户明确要求。

性能与可靠性：prepare 扫描约 52 个 Markdown 和约 2100 张图片，时间复杂度 O(N)；瓶颈是构建期复制被引用的图片，缓解方式是只复制文章实际引用的图片并按内容哈希去重，重复图片不重复复制。图片按 basename/alt 匹配属启发式，存在同名误配风险，以 ponytail 注释标注上限，升级路径是维护显式映射表。

## 实现注意事项

- 不移动、不重命名任何原始笔记目录；所有新代码集中在 `blog/`，保持 git 历史与现有工作流不受影响。
- `blog/source/_posts`、`blog/source/images`、`blog/public`、`blog/node_modules` 全部加入 `.gitignore`。
- 第三方外链图片（如 `img.smyhvae.com`、`cn.vuejs.org`）在 prepare 中尝试下载到本地，失败则移除链接并写入缺失清单，用 `ponytail:` 注释标注降级边界与后续补图方案。
- Butterfly 默认从海外 CDN 加载第三方库，需在 `_config.butterfly.yml` 中关闭或替换：优先把主题所需资源复制到 `blog/source/` 随站点发布；无法本地化的改走国内镜像，用 `ponytail:` 注释标注。
- 若 npm 主题未被 Hexo 自动解析，在 `package.json` 的 postinstall 中把 `node_modules` 里的主题复制到 `blog/themes/butterfly` 作为兜底。
- 日志只输出缺失图片清单与计数，不打印大段正文或敏感信息。

## 架构设计

```mermaid
flowchart LR
  A[原始笔记与本地图片] --> B[prepare.js 去重筛选/补frontmatter/重写图片]
  B --> C[blog/source: _posts 与 images]
  C --> D[check.js 自检]
  D --> E[hexo generate 生成 blog/public]
  E --> F[Cloudflare Pages Git 集成自动构建部署]
```

数据流：原始笔记（只读）经 prepare 生成站点源内容与图片引用，自检通过后由 Hexo 编译为静态 HTML，push 到 main 触发 Cloudflare Pages 构建并发布。原笔记与站点产物完全解耦。

## 目录结构（全部为新增，原始笔记目录保持不动）

```
notes/
├── blog/
│   ├── package.json              # [NEW] hexo init 标准依赖 + hexo-theme-butterfly + prepare/build/check 脚本 + postinstall 主题兜底
│   ├── _config.yml               # [NEW] Hexo 主配置：root=/、theme=butterfly、ASCII 短链、站点标题与描述
│   ├── _config.butterfly.yml     # [NEW] 主题配置：首页卡片列表、标签/分类/归档页、深色模式、代码高亮、图片灯箱、资源本地化或走 npmmirror
│   ├── .gitignore                # [NEW] 忽略 node_modules、public、source/_posts、source/images
│   └── scripts/
│       ├── prepare.js            # [NEW] 筛选去重主笔记、补 frontmatter、按 basename/alt/兄弟文件重写图片链接、按哈希去重复制本地图、下载第三方图失败则移除并记清单
│       └── check.js              # [NEW] 扫描生成的源内容，断言无 OSS 残留且图片齐全，输出缺失清单并以非零码退出
└── README.md                     # [NEW] 新增笔记命名约定、本地预览命令、Cloudflare Pages 项目创建与构建设置步骤（Root directory / Build command / output / NODE_VERSION）、已知图片降级清单查看方式
```

## 关键说明

- frontmatter 的 date 取文件 mtime，categories 取顶层目录名，tags 取次级目录或文件夹名，title 取首个一级标题或文件名。
- 图片重写后写入形如 `/images/<hash>.<ext>` 的路径，Hexo 结合 root `/` 输出为 `/images/<hash>.<ext>`，适配 Cloudflare Pages 根路径。
- Cloudflare Pages 构建命令串联 `npm run prepare && npm run check && npx hexo generate`，任一步失败即中止部署。
- 用户在 Cloudflare 控制台连接 GitHub 仓库并按上述构建设置创建 Pages 项目，后续 push 自动部署，无需配置 GitHub Actions 权限。

## 设计风格

基于 Hexo + Butterfly 主题打造现代技术博客视觉，整体为「清爽卡片式 + 深色模式」。首页以渐变头图与简介开场，下方文章卡片网格悬浮时轻微上浮与阴影加深；代码与图片阅读体验优先，代码块带语法高亮与复制按钮，图片支持灯箱放大。全站响应式，桌面三栏（导航/正文/目录）与移动单栏自适应，配阅读进度条与平滑滚动微动效。中文字体使用系统字体栈，避免海外字体源导致的加载失败。

## 页面与区块（共 5 页）

1. 首页：顶部导航（首页/标签/分类/归档/关于、搜索、深色切换）；渐变 Hero 博主介绍；文章卡片列表；侧边标签云与最新文章；底部版权与 GitHub 链接。
2. 归档页：顶部导航；归档标题与年份分组；时间线卡片列表按年折叠；底部栏。
3. 标签页：顶部导航；标签云字号随文章数变化；标签筛选后的文章列表；底部栏。
4. 分类页：顶部导航；分类卡片网格按技术方向分组；分类文章计数；底部栏。
5. 文章页：顶部导航；面包屑与标题元信息；正文排版区（代码高亮/图片灯箱/引用样式）；右侧目录 TOC；上一篇下一篇与标签；评论区占位；底部栏。