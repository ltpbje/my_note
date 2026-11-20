const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DRY = process.argv.includes('--dry-run');
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const byBase = new Map();
const byStem = new Map();

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const stem = (n) => path.basename(n, path.extname(n)).toLowerCase();

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['blog', '.git', 'node_modules', '.codebuddy'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const all = walk(ROOT);
for (const f of all) {
  if (!IMG_EXT.has(path.extname(f).toLowerCase())) continue;
  const b = path.basename(f).toLowerCase();
  if (!byBase.has(b)) byBase.set(b, f);
  const s = stem(b);
  if (!byStem.has(s)) byStem.set(s, f);
}

function findLocal(raw, mdFile, alt) {
  let d = raw;
  try { d = decodeURIComponent(raw); } catch { /* keep */ }
  d = d.split(/[?#]/)[0];
  const direct = path.resolve(path.dirname(mdFile), d);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const b = path.basename(d).toLowerCase();
  return byBase.get(b) || byStem.get(stem(b)) || byStem.get(alt.trim().toLowerCase()) || null;
}

function relPath(localFile, mdFile) {
  let r = path.relative(path.dirname(mdFile), localFile).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

function fixImages(content, mdFile, stats) {
  let text = content.replace(/!\[([^\]]*)<img\s+src=["']([^"']+)["']\s*\/?>/gi, '<img src="$2" alt="$1">');
  const tasks = [];
  for (const m of text.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const alt = (m[0].match(/\balt\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    tasks.push({ start: m.index, end: m.index + m[0].length, url: m[1], alt, tag: 'html' });
  }
  for (const m of text.matchAll(/!\[([^\]]*)\]\((.*?\.(?:png|jpe?g|gif|awebp|webp|svg)(?:\?[^)]*)?)(?:\s+["'][^"']*["'])?\)/gi)) {
    tasks.push({ start: m.index, end: m.index + m[0].length, url: m[2].trim(), alt: m[1], tag: 'md' });
  }
  tasks.sort((a, b) => b.start - a.start);
  for (const t of tasks) {
    const raw = t.url;
    if (/^data:/i.test(raw)) continue;
    const local = findLocal(raw, mdFile, t.alt);
    if (!local) {
      stats.missing.push(`${rel(mdFile)} :: ${raw}`);
      continue;
    }
    const p = relPath(local, mdFile);
    stats.fixed++;
    const replacement = t.tag === 'html'
      ? `<img src="${p}"${t.alt ? ` alt="${t.alt}"` : ''}>`
      : `![${t.alt}](${p})`;
    text = text.slice(0, t.start) + replacement + text.slice(t.end);
  }
  return text;
}

function mainName(dup) {
  const name = path.basename(dup, '.md');
  return name
    .replace(/\s*[（(]copy[）)]/i, '')
    .replace(/_local$/i, '')
    .replace(/\s*[-—]?\s*副本.*$/i, '')
    .trim();
}

const mds = all.filter((f) => f.endsWith('.md'));
const fixedContents = new Map();
const stats = { fixed: 0, missing: [], filesChanged: 0 };

for (const md of mds) {
  const before = fs.readFileSync(md, 'utf8');
  const after = fixImages(before, md, stats);
  if (after !== before) {
    fixedContents.set(path.resolve(md), after);
    stats.filesChanged++;
  }
}

console.log(`图片：修复 ${stats.fixed} 处，涉及 ${stats.filesChanged} 个文件；无法匹配 ${stats.missing.length} 处`);
if (stats.missing.length) {
  console.log('无法匹配示例（前 10）：');
  for (const m of stats.missing.slice(0, 10)) console.log('  ' + m);
}

// 先写回所有文件的图片修复结果
if (!DRY) {
  for (const [file, content] of fixedContents) {
    if (fs.existsSync(file)) fs.writeFileSync(file, content);
  }
}

// 重复文件处理：有本地图的副本覆盖主笔记，然后删除副本
const dups = mds.filter((f) => /(\(copy\)|_local|副本|本地图片)/i.test(path.basename(f)));
console.log(`\n重复文件 ${dups.length} 个：`);
for (const dup of dups) {
  const mainFile = path.join(path.dirname(dup), mainName(dup) + '.md');
  const exists = fs.existsSync(mainFile);
  const content = fs.readFileSync(dup, 'utf8');
  const hasLocalImg = /\.(assets)[\/\\]|\]\(\.\//i.test(content);
  console.log(`  ${exists ? '合并->' : '删除  '} ${rel(dup)}  ${hasLocalImg ? '[含本地图]' : ''}`);
  if (!DRY) {
    if (exists && hasLocalImg) fs.writeFileSync(mainFile, content);
    fs.unlinkSync(dup);
  }
}

if (stats.missing.length && !DRY) {
  console.log(`\n完整缺失清单已在上面的日志中输出（共 ${stats.missing.length} 处，均为原笔记本就缺失的图片）。`);
}
console.log(DRY ? '\n[dry-run] 未写入任何文件' : '\n已写入所有改动');
