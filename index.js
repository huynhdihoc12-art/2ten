// index.js - Entry point chính
// CLI crawler với các lệnh: setup, list, manga, chapter, all, status
require('dotenv').config();
const logger = require('./src/utils/logger');
const { setupDatabase } = require('./src/db/setup');
const { closePool, query } = require('./src/db/connection');
const { crawlAllListPages } = require('./src/crawlers/listCrawler');
const { crawlAllMangaDetails } = require('./src/crawlers/mangaCrawler');
const { crawlAllChapterImages } = require('./src/crawlers/chapterCrawler');
const { createSession, updateSession } = require('./src/db/models');

// ─────────────────────────────────────────────────────────
// HELPER: Progress Bar
// ─────────────────────────────────────────────────────────
function createProgressBar(label, total) {
  const { SingleBar, Presets } = require('cli-progress');
  const bar = new SingleBar(
    {
      format: `${label} [{bar}] {percentage}% | {value}/{total} | ETA:{eta}s`,
      clearOnComplete: false,
      hideCursor: true,
    },
    Presets.shades_classic
  );
  bar.start(Math.max(total || 1, 1), 0);
  return bar;
}

// ─────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────

async function cmdSetup() {
  console.log('\n══════════════════════════════════════');
  console.log('  🛠️  SETUP DATABASE');
  console.log('══════════════════════════════════════\n');
  await setupDatabase();
}

async function cmdCrawlList() {
  console.log('\n══════════════════════════════════════');
  console.log('  📋 CRAWL DANH SÁCH TRUYỆN');
  console.log('══════════════════════════════════════\n');

  let bar = null;
  const saved = await crawlAllListPages(({ page, maxPage, totalSaved }) => {
    if (!bar && maxPage > 1) bar = createProgressBar('Trang', maxPage);
    if (bar) bar.update(page);
  });
  if (bar) bar.stop();
  console.log(`\n✅ Đã lưu ${saved} truyện vào DB\n`);
}

async function cmdCrawlMangas() {
  console.log('\n══════════════════════════════════════');
  console.log('  📚 CRAWL CHI TIẾT TRUYỆN');
  console.log('══════════════════════════════════════\n');

  const [countRow] = await query('SELECT COUNT(*) as cnt FROM mangas WHERE total_chapters = 0');
  const total = parseInt(countRow.cnt);
  console.log(`⏳ ${total} truyện cần crawl chi tiết...\n`);

  const bar = createProgressBar('Truyện', total);
  const result = await crawlAllMangaDetails(({ processed, errors }) => {
    bar.update(processed + errors);
  });
  bar.stop();
  console.log(`\n✅ ${result.processed} thành công, ${result.errors} lỗi\n`);
}

async function cmdCrawlChapters() {
  console.log('\n══════════════════════════════════════');
  console.log('  🖼️  CRAWL ẢNH CHAPTER');
  console.log('══════════════════════════════════════\n');

  const [countRow] = await query('SELECT COUNT(*) as cnt FROM chapters WHERE page_count = 0');
  const total = parseInt(countRow.cnt);
  console.log(`⏳ ${total} chapters cần crawl ảnh...\n`);

  const bar = createProgressBar('Chapter', total);
  const result = await crawlAllChapterImages(({ processed, errors, totalImages }) => {
    bar.update(processed + errors);
  });
  bar.stop();
  console.log(`\n✅ ${result.processed} chapters, ${result.totalImages} ảnh, ${result.errors} lỗi\n`);
}

async function cmdCrawlAll() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🕷️  CRAWL TOÀN BỘ VINAHENTAI      ║');
  console.log('║   List → Detail → Images             ║');
  console.log('╚══════════════════════════════════════╝\n');

  const sessionId = await createSession();
  const stats = { mangas: 0, chapters: 0, images: 0, errors: 0 };

  // Bước 1: Listing
  console.log('[1/3] 📋 Crawl danh sách truyện...');
  let bar1 = null;
  stats.mangas = await crawlAllListPages(({ page, maxPage }) => {
    if (!bar1 && maxPage > 1) bar1 = createProgressBar('Trang', maxPage);
    if (bar1) bar1.update(page);
  });
  if (bar1) bar1.stop();
  console.log(`      ✓ ${stats.mangas} truyện\n`);

  // Bước 2: Manga details
  console.log('[2/3] 📚 Crawl chi tiết truyện...');
  const [mRow] = await query('SELECT COUNT(*) as cnt FROM mangas WHERE total_chapters = 0');
  const mTotal = parseInt(mRow.cnt);
  const bar2 = createProgressBar('Truyện', mTotal);
  const mangaResult = await crawlAllMangaDetails(({ processed, errors }) => {
    bar2.update(processed + errors);
    stats.errors += errors;
  });
  bar2.stop();
  stats.chapters = mangaResult.processed;
  console.log(`      ✓ ${mangaResult.processed} thành công\n`);

  // Bước 3: Chapter images
  console.log('[3/3] 🖼️  Crawl ảnh chapter...');
  const [cRow] = await query('SELECT COUNT(*) as cnt FROM chapters WHERE page_count = 0');
  const cTotal = parseInt(cRow.cnt);
  const bar3 = createProgressBar('Chapter', cTotal);
  const chapterResult = await crawlAllChapterImages(({ processed, errors, totalImages }) => {
    bar3.update(processed + errors);
    stats.images = totalImages;
    stats.errors += errors;
  });
  bar3.stop();
  console.log(`      ✓ ${chapterResult.processed} chapters, ${chapterResult.totalImages} ảnh\n`);

  // Cập nhật session
  await updateSession(sessionId, {
    ...stats,
    status: 'done',
    ended_at: new Date(),
  });

  await printStatus();
}

async function cmdCrawlSync() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🔄  ĐỒNG BỘ MỚI NHẤT (TOP 120)     ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Override môi trường để chỉ quét 3 trang đầu
  process.env.CRAWLER_START_PAGE = '1';
  process.env.CRAWLER_END_PAGE = '3';

  console.log('[1/3] 📋 Quét 3 trang danh sách mới nhất...');
  let bar1 = null;
  await crawlAllListPages(({ page, maxPage }) => {
    if (!bar1 && maxPage > 1) bar1 = createProgressBar('Trang', 3); // Cố định bar 3
    if (bar1 && page <= 3) bar1.update(page);
  });
  if (bar1) bar1.stop();
  console.log(`      ✓ Hoàn tất lấy danh sách\n`);

  console.log('[2/3] 📚 Cập nhật chi tiết các truyện vừa quét...');
  const rows = await query('SELECT slug, source_url, id, title FROM mangas ORDER BY updated_at DESC LIMIT 120');
  
  const { crawlOneManga } = require('./src/crawlers/mangaCrawler');
  const pLimit = require('p-limit');
  const limit = pLimit(parseInt(process.env.CRAWLER_CONCURRENCY) || 3);
  let processed = 0, errors = 0;
  
  const bar2 = createProgressBar('Truyện', rows.length);
  const tasks = rows.map(m => limit(async () => {
    try {
      await crawlOneManga(m.slug, m.source_url, m.id);
      processed++;
    } catch(e) {
      errors++;
    }
    bar2.update(processed + errors);
  }));
  await Promise.all(tasks);
  bar2.stop();
  console.log(`\n      ✓ Cập nhật ${processed} truyện thành công, ${errors} lỗi\n`);

  console.log('[3/3] 🖼️  Tải ảnh các chương mới...');
  await cmdCrawlChapters();
}

async function cmdStatus() {
  await printStatus();
}

async function printStatus() {
  const [[mangaRow], [chapterRow], [imageRow], [pendingManga], [pendingChapter]] =
    await Promise.all([
      query('SELECT COUNT(*) as cnt FROM mangas'),
      query('SELECT COUNT(*) as cnt FROM chapters'),
      query('SELECT COUNT(*) as cnt FROM chapter_images'),
      query('SELECT COUNT(*) as cnt FROM mangas WHERE total_chapters = 0'),
      query('SELECT COUNT(*) as cnt FROM chapters WHERE page_count = 0'),
    ]);

  const sessions = await query(
    'SELECT * FROM crawl_sessions ORDER BY id DESC LIMIT 5'
  );

  console.log('\n' + '═'.repeat(52));
  console.log('  📊 THỐNG KÊ DATABASE - VinHentai Crawler');
  console.log('═'.repeat(52));
  console.log(`  📚 Tổng truyện          : ${mangaRow.cnt}`);
  console.log(`  📖 Tổng chapter         : ${chapterRow.cnt}`);
  console.log(`  🖼️  Tổng ảnh             : ${imageRow.cnt}`);
  console.log(`  ⏳ Manga chờ crawl      : ${pendingManga.cnt}`);
  console.log(`  ⏳ Chapter chờ crawl    : ${pendingChapter.cnt}`);
  console.log('─'.repeat(52));
  if (sessions.length > 0) {
    console.log('  🕐 5 phiên crawl gần nhất:');
    sessions.forEach((s) => {
      const end = s.ended_at ? new Date(s.ended_at).toLocaleTimeString() : 'đang chạy';
      console.log(
        `  [${s.id}] ${s.status.padEnd(7)} | ${String(s.mangas_crawled).padStart(4)} manga` +
        ` | ${String(s.chapters_crawled).padStart(5)} chap` +
        ` | ${String(s.images_crawled).padStart(7)} img` +
        ` | ${s.errors} err`
      );
    });
  }
  console.log('═'.repeat(52) + '\n');
}

// ─────────────────────────────────────────────────────────
// MAIN CLI
// ─────────────────────────────────────────────────────────
async function main() {
  const cmd = process.argv[2] || 'help';

  const commands = {
    setup:   cmdSetup,
    list:    cmdCrawlList,
    manga:   cmdCrawlMangas,
    chapter: cmdCrawlChapters,
    all:     cmdCrawlAll,
    sync:    cmdCrawlSync,
    status:  cmdStatus,
  };

  if (cmd === 'help' || !commands[cmd]) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║          VinHentai Crawler - Powered by TiDB             ║
╚══════════════════════════════════════════════════════════╝

Cách dùng:  node index.js <command>

  setup     - Tạo database và các bảng trong TiDB
  list      - Crawl trang danh sách (lấy slug tất cả truyện)
  manga     - Crawl chi tiết từng truyện (metadata + chapter list)
  chapter   - Crawl ảnh từng chapter
  all       - Chạy toàn bộ pipeline: list → manga → chapter
  sync      - CHỈ cập nhật 120 truyện mới nhất (Web tự update chapter)
  status    - Xem thống kê database hiện tại

Ví dụ nhanh:
  node index.js setup        ← chạy lần đầu để tạo DB
  node index.js sync         ← CẬP NHẬT TRUYỆN MỚI HÀNG NGÀY
  node index.js all          ← crawl toàn bộ
  node index.js status       ← xem tiến độ

NPM scripts:
  npm run setup
  npm run crawl:all
  npm run status
  npm run test:parsers       ← test parser không cần DB
`);
    process.exit(0);
  }

  try {
    await commands[cmd]();
  } catch (e) {
    logger.error(`LỖI: ${e.message}`);
    if (process.env.DEBUG === '1') console.error(e.stack);
    process.exit(1);
  } finally {
    await closePool();
    process.exit(0);
  }
}

main();
