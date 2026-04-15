// test/test-parsers.js
// Script test nhanh để kiểm tra parsers hoạt động đúng
// Không cần DB - chỉ fetch URL thật và in kết quả
require('dotenv').config();
const { fetchPage } = require('../src/utils/http');
const { parseListPage } = require('../src/parsers/listParser');
const { parseMangaDetail } = require('../src/parsers/mangaParser');
const { parseChapterImages } = require('../src/parsers/chapterParser');

const BASE_URL = process.env.TARGET_BASE_URL || 'https://vinahentai.me';

async function testAll() {
  console.log('='.repeat(60));
  console.log('🧪 TEST PARSERS - Kiểm tra không cần DB');
  console.log('='.repeat(60));

  // ── Test 1: Listing page ──
  console.log('\n[1/3] 📋 Test Listing Page...');
  try {
    const listUrl = `${BASE_URL}/danh-sach`;
    const html = await fetchPage(listUrl);
    const items = parseListPage(html, listUrl);

    console.log(`✅ Listing: ${items.length} truyện tìm thấy`);
    if (items.length > 0) {
      console.log('   Ví dụ 3 truyện đầu:');
      items.slice(0, 3).forEach((item, i) => {
        console.log(`   [${i+1}] ${item.title}`);
        console.log(`       slug: ${item.slug}`);
        console.log(`       url: ${item.sourceUrl}`);
        console.log(`       cover: ${item.coverUrl || '(không có)'}`);
      });
    }
  } catch (e) {
    console.error(`❌ Listing FAIL: ${e.message}`);
  }

  // ── Test 2: Manga detail ──
  console.log('\n[2/3] 📚 Test Manga Detail Page...');
  const testMangaSlug = 'babu-babu-micomet';
  const testMangaUrl = `${BASE_URL}/truyen-hentai/${testMangaSlug}`;
  try {
    const html = await fetchPage(testMangaUrl);
    const detail = parseMangaDetail(html, testMangaUrl);

    console.log(`✅ Manga: "${detail.title}"`);
    console.log(`   Tác giả: ${detail.author || 'N/A'}`);
    console.log(`   Trạng thái: ${detail.status || 'N/A'}`);
    console.log(`   Thể loại: ${detail.genres.map(g => g.name).join(', ') || 'N/A'}`);
    console.log(`   Số chapter: ${detail.chapters.length}`);
    console.log(`   Cover: ${detail.coverUrl || '(không có)'}`);
    if (detail.chapters.length > 0) {
      console.log(`   Chapter đầu: ${detail.chapters[0].chapterNum} → ${detail.chapters[0].sourceUrl}`);
    }
  } catch (e) {
    console.error(`❌ Manga Detail FAIL: ${e.message}`);
  }

  // ── Test 3: Chapter images ──
  console.log('\n[3/3] 🖼️  Test Chapter Page...');
  const testChapterUrl = `${BASE_URL}/truyen-hentai/babu-babu-micomet/chap-1`;
  try {
    const html = await fetchPage(testChapterUrl);
    const images = parseChapterImages(html, testChapterUrl);

    console.log(`✅ Chapter: ${images.length} ảnh tìm thấy`);
    if (images.length > 0) {
      console.log('   Ví dụ 3 URL đầu:');
      images.slice(0, 3).forEach((img, i) => {
        console.log(`   [${i+1}] ${img.url}`);
      });
    } else {
      console.log('   ⚠️  Không tìm thấy ảnh! Parser cần điều chỉnh.');
      // Debug: in raw script content
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const nextData = $('#__NEXT_DATA__').html();
      if (nextData) {
        console.log('   📦 __NEXT_DATA__ có tồn tại, độ dài:', nextData.length, 'chars');
        // In preview
        console.log('   Preview __NEXT_DATA__:', nextData.substring(0, 300) + '...');
      } else {
        console.log('   ❌ Không có __NEXT_DATA__ trong HTML');
        // In tất cả script src
        const scripts = $('script[src]').map((_, el) => $(el).attr('src')).toArray();
        console.log('   Script tags:', scripts.slice(0, 5));
      }
    }
  } catch (e) {
    console.error(`❌ Chapter FAIL: ${e.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test hoàn tất! Kiểm tra kết quả ở trên.');
  console.log('='.repeat(60));
  process.exit(0);
}

testAll().catch(console.error);
