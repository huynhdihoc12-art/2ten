// test/debug-chapter.js
// Debug script: xem __NEXT_DATA__ chứa gì để fix chapter parser
require('dotenv').config();
const { fetchPage } = require('../src/utils/http');
const cheerio = require('cheerio');
const fs = require('fs');

async function debugChapter() {
  const url = 'https://vinahentai.me/truyen-hentai/babu-babu-micomet/chap-1';
  console.log('Fetching:', url);
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Lấy __NEXT_DATA__
  const nextDataRaw = $('#__NEXT_DATA__').html();
  if (!nextDataRaw) {
    console.log('❌ Không có __NEXT_DATA__');
    // Lưu raw HTML để xem
    fs.writeFileSync('test/debug-chapter.html', html);
    console.log('HTML đã lưu vào test/debug-chapter.html');
    return;
  }

  console.log('✅ __NEXT_DATA__ độ dài:', nextDataRaw.length, 'chars');

  const data = JSON.parse(nextDataRaw);
  
  // Lưu full JSON để phân tích
  fs.writeFileSync('test/debug-nextdata.json', JSON.stringify(data, null, 2));
  console.log('📦 Full JSON đã lưu vào test/debug-nextdata.json');

  // In cấu trúc top-level
  console.log('\n📁 Cấu trúc top-level:');
  function printKeys(obj, prefix = '', depth = 0) {
    if (depth > 4 || !obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const type = Array.isArray(v) ? `Array[${v.length}]` : typeof v;
      const preview = typeof v === 'string' ? `: "${v.substring(0,60)}"` : '';
      console.log(`${prefix}${k} (${type})${preview}`);
      if (type === 'object' && depth < 3) printKeys(v, prefix + '  ', depth + 1);
      if (type.startsWith('Array') && v.length > 0 && typeof v[0] === 'object') {
        console.log(`${prefix}  [0] keys: ${Object.keys(v[0]).join(', ')}`);
      }
    }
  }
  printKeys(data);

  // Tìm tất cả URL ảnh trong toàn bộ JSON
  const jsonStr = JSON.stringify(data);
  const imgMatches = [...jsonStr.matchAll(/https?:\/\/cdn\.vinahentai\.me\/manga-images\/[^"\\]+/g)];
  console.log(`\n🖼️  URL ảnh tìm thấy trong JSON: ${imgMatches.length}`);
  imgMatches.slice(0, 5).forEach((m, i) => console.log(`  [${i+1}] ${m[0]}`));

  process.exit(0);
}

debugChapter().catch(e => { console.error(e); process.exit(1); });
