const fs = require('fs');
const path = require('path');
const assert = require('assert');

const BLOG = path.resolve(__dirname, '..');
const POSTS = path.join(BLOG, 'source/_posts');
const IMAGES = path.join(BLOG, 'source/images');

const files = fs.readdirSync(POSTS).filter((f) => f.endsWith('.md'));
assert(files.length > 0, '没有生成任何文章，请检查 prepare 脚本');

const missing = [];
const stale = [];
let refs = 0;

for (const f of files) {
  const text = fs.readFileSync(path.join(POSTS, f), 'utf8');
  if (/ltpbje\.oss|oss-cn-zhangjiakou/i.test(text)) stale.push(f);
  for (const m of text.matchAll(/\]\((\/images\/[^)]+)\)/g)) {
    refs++;
    if (!fs.existsSync(path.join(BLOG, 'source', m[1]))) missing.push(`${f} :: ${m[1]}`);
  }
}

assert(stale.length === 0, `仍有 OSS 外链残留：${stale.join(', ')}`);
assert(missing.length === 0, `有 ${missing.length} 个图片引用找不到文件：\n${missing.slice(0, 10).join('\n')}`);

const images = fs.readdirSync(IMAGES).length;
console.log(`自检通过：${files.length} 篇文章，${refs} 处图片引用，${images} 张本地图片，无 OSS 残留。`);
