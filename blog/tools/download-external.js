const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['blog', '.git', '.codebuddy', 'node_modules'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

async function download(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 10 * 1024 * 1024) return null;
    const ct = r.headers.get('content-type') || '';
    const ext = ct.includes('jpeg') ? '.jpg' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : '.png';
    return { buf, ext };
  } catch {
    return null;
  }
}

async function main() {
  let total = 0, saved = 0, failed = 0;
  for (const md of walk(ROOT).filter((f) => f.endsWith('.md'))) {
    let text = fs.readFileSync(md, 'utf8');
    const imgs = [...text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)];
    if (!imgs.length) continue;
    const assets = path.join(path.dirname(md), path.basename(md, '.md') + '.assets');
    for (const m of imgs) {
      total++;
      const data = await download(m[2]);
      if (!data) { failed++; console.log('失败  ', m[2].slice(0, 70)); continue; }
      fs.mkdirSync(assets, { recursive: true });
      const name = crypto.createHash('sha256').update(m[2]).digest('hex').slice(0, 10) + data.ext;
      fs.writeFileSync(path.join(assets, name), data.buf);
      const relPath = './' + path.basename(assets) + '/' + name;
      text = text.replace(m[0], `![${m[1]}](${relPath})`);
      saved++;
    }
    fs.writeFileSync(md, text);
  }
  console.log(`\n外链图片 ${total} 处：下载成功 ${saved}，失败保留原样 ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
