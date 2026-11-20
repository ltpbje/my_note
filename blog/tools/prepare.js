const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const POSTS = path.join(ROOT, 'blog/source/_posts');
const IMAGES = path.join(ROOT, 'blog/source/images');
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

// 图片已在 fix-notes.js 中写回原笔记为本地相对路径，这里直接以原笔记为源
const LOCAL_VARIANTS = {};

const EXCLUDE = /(^README\.md$|_local|\(copy\)|副本|^test|Untitled|result-(local|remote)|[\\/]mcp-audit[\\/])/i;
const missing = [];
const byBase = new Map();
const byStem = new Map();

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const stem = (name) => path.basename(name, path.extname(name)).toLowerCase();
const pad = (n) => String(n).padStart(2, '0');
const yaml = (s) => JSON.stringify(String(s).replace(/[\r\n]+/g, ' '));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['blog', '.git', '.codebuddy', 'node_modules'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function indexImages(files) {
  // ponytail: 同名图片只取第一个匹配，跨目录同名存在误配风险；升级路径是维护显式 URL->文件映射表
  for (const f of files) {
    if (!IMG_EXT.has(path.extname(f).toLowerCase())) continue;
    const base = path.basename(f).toLowerCase();
    if (!byBase.has(base)) byBase.set(base, f);
    const s = stem(base);
    if (!byStem.has(s)) byStem.set(s, f);
  }
}

function saveImage(buf, ext) {
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
  const name = `${hash}${ext}`;
  const dest = path.join(IMAGES, name);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf);
  return `/images/${name}`;
}

async function download(url) {
  // ponytail: 第三方外链 8 秒超时且上限 10MB，失败即移除图片；升级路径是人工补图到对应 assets 目录
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= 10 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

function extractAlt(tag) {
  const m = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
  return m ? m[1] : '';
}

function findLocal(raw, srcFile, alt) {
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* keep raw */ }
  decoded = decoded.split(/[?#]/)[0];
  const direct = path.resolve(path.dirname(srcFile), decoded);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const base = path.basename(decoded).toLowerCase();
  return byBase.get(base) || byStem.get(stem(base)) || byStem.get(alt.trim().toLowerCase()) || null;
}

async function resolveImage(url, srcFile, alt, original) {
  if (!url || /^data:/i.test(url)) return original;
  let buf, ext, sitePath;

  if (/^https?:\/\//i.test(url)) {
    const parsed = new URL(url);
    if (/ltpbje\.oss|oss-cn-zhangjiakou/i.test(url)) {
      const file = findLocal(path.basename(parsed.pathname), srcFile, alt);
      if (!file) {
        missing.push(`${rel(srcFile)} :: ${url}`);
        return '';
      }
      buf = fs.readFileSync(file);
      ext = path.extname(file).toLowerCase() || '.png';
    } else {
      const data = await download(url);
      if (!data) {
        missing.push(`${rel(srcFile)} :: ${url}`);
        return '';
      }
      buf = data;
      ext = path.extname(parsed.pathname).toLowerCase() || '.png';
      if (ext === '.awebp') ext = '.webp';
    }
    sitePath = saveImage(buf, ext);
  } else {
    const file = findLocal(url, srcFile, alt);
    if (!file) {
      missing.push(`${rel(srcFile)} :: ${url}`);
      return '';
    }
    buf = fs.readFileSync(file);
    ext = path.extname(file).toLowerCase() || '.png';
    sitePath = saveImage(buf, ext);
  }

  return alt ? `![${alt}](${sitePath})` : `![](${sitePath})`;
}

async function rewriteImages(content, srcFile) {
  // 修复 Typora 生成的畸形片段 `![alt<img src="...">`
  let text = content.replace(/!\[([^\]]*)<img\s+src=["']([^"']+)["']\s*\/?>/gi, '<img src="$2" alt="$1">');
  const tasks = [];
  for (const m of text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    tasks.push({ start: m.index, end: m.index + m[0].length, url: m[1], alt: extractAlt(m[0]) });
  }
  for (const m of text.matchAll(/!\[([^\]]*)\]\((.*?\.(?:png|jpe?g|gif|awebp|webp|svg)(?:\?[^)]*)?)(?:\s+["'][^"']*["'])?\)/gi)) {
    tasks.push({ start: m.index, end: m.index + m[0].length, url: m[2].trim(), alt: m[1] });
  }
  tasks.sort((a, b) => b.start - a.start);
  for (const t of tasks) {
    const replacement = await resolveImage(t.url, srcFile, t.alt, '');
    text = text.slice(0, t.start) + replacement + text.slice(t.end);
  }
  return text;
}

function frontmatter(srcFile, mainRel, body) {
  const title = path.basename(mainRel, '.md');
  const parts = mainRel.split('/').slice(0, -1);
  const d = fs.statSync(srcFile).mtime;
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const categories = parts.slice(0, 1);
  const tags = parts.length > 1 ? parts.slice(1, 3) : categories;
  return [
    '---',
    `title: ${yaml(title)}`,
    `date: ${date}`,
    `categories: [${categories.map(yaml).join(', ')}]`,
    `tags: [${tags.map(yaml).join(', ')}]`,
    '---',
    ''
  ].join('\n');
}

function clean(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
}

async function main() {
  clean(POSTS);
  fs.mkdirSync(IMAGES, { recursive: true });

  const files = walk(ROOT);
  indexImages(files);
  const candidates = files
    .filter((f) => f.endsWith('.md') && !EXCLUDE.test(rel(f)) && fs.statSync(f).size > 50)
    .sort();

  let count = 0;
  for (const main of candidates) {
    const mainRel = rel(main);
    const variant = LOCAL_VARIANTS[mainRel];
    const srcFile = variant ? path.join(ROOT, variant) : main;
    if (!fs.existsSync(srcFile)) {
      missing.push(`${mainRel} :: 本地图片版缺失 ${variant}`);
      continue;
    }
    let body = fs.readFileSync(srcFile, 'utf8');
    if (body.startsWith('---')) {
      const end = body.indexOf('\n---', 3);
      if (end > 0) body = body.slice(end + 4).replace(/^\s*\n/, '');
    }
    body = await rewriteImages(body, srcFile);
    // ponytail: 小程序笔记里的 {{ }} 会被 Hexo 的 Nunjucks 当模板解析，转义成实体后浏览器显示不变
    body = body.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
    const slug = crypto.createHash('sha1').update(mainRel).digest('hex').slice(0, 10);
    fs.writeFileSync(path.join(POSTS, `${slug}.md`), frontmatter(srcFile, mainRel, body) + body);
    count++;
  }

  const imageCount = fs.readdirSync(IMAGES).length;
  console.log(`已生成 ${count} 篇文章，${imageCount} 张图片，缺失 ${missing.length} 张`);
  if (missing.length) {
    console.log('缺失清单（前 20 条）：');
    for (const m of missing.slice(0, 20)) console.log(`  - ${m}`);
    fs.writeFileSync(path.join(ROOT, 'blog/missing-images.txt'), missing.join('\n') + '\n');
  } else {
    const f = path.join(ROOT, 'blog/missing-images.txt');
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
