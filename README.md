# 前端学习笔记博客

把仓库里的 Typora 笔记自动转成个人博客，使用 Hexo + Butterfly 主题，部署在 Cloudflare Pages，全程免费。

## 本地预览

```bash
cd blog
npm install
npm run gen:posts   # 去重、补文章信息、把图片本地化
npm run check       # 自检：无 OSS 残留、图片引用完整
npx hexo server     # 打开 http://localhost:4000
```

完整构建：`npm run build`（等价于 `gen:posts` → `check` → `hexo generate`）。

## 新增笔记

- 笔记放在仓库根目录的任意文件夹，不要放进 `blog/`；用 Typora 正常编辑，图片用相对路径即可。
- `blog/source/_posts` 是自动生成目录，不要手工往里放文件。
- 文件名含 `_local`、`(copy)`、`副本` 的笔记会被当作重复项跳过。
- 若某篇笔记同时存在「正式版」和「本地图片版」，在 `blog/tools/prepare.js` 的 `LOCAL_VARIANTS` 中登记映射，构建时会优先使用本地图片版（原阿里云 OSS 外链已失效，返回 404）。
- 图片按内容哈希去重后复制到 `blog/source/images`，只引用实际用到的图片，仓库体积不会翻倍。

## 图片缺失

原笔记中本就不存在的图片（如 `./uploads/xxx.png`）以及失效且无 alt 无法匹配的 OSS 图，会从正文中移除，清单在本地生成于 `blog/missing-images.txt`（已 gitignore，不会入库）。构建自检只拦截「仍有外链残留」或「引用了不存在的图片」，不会因这些已知缺失而失败。

## 上线到 Cloudflare Pages

1. 确认代码已推送到 GitHub 仓库 `ltpbje/my_note` 的 `main` 分支。
2. Cloudflare 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，选择该仓库。
3. 构建设置：
   - Project name：`my-note`（决定访问地址 `https://my-note.pages.dev`）
   - Root directory：`blog`
   - Build command：`npm ci && npm run gen:posts && npm run check && npx hexo generate`
   - Build output：`public`
   - Environment variables：`NODE_VERSION=20`
4. 保存并部署。之后每次 push 到 `main` 都会自动重新构建上线。

站点根路径为 `/`，不使用自定义域名。主题所需的 JS/CSS 随站点一起发布，中文字体使用系统字体栈，不依赖海外 CDN。

## 目录说明

- `blog/` —— 站点代码、主题配置、生成与自检脚本
- 其余目录 —— 原始 Typora 笔记与图片，构建脚本只读，不会改动
