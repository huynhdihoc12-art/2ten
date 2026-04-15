// src/crawlers/chapterCrawler.js
// Crawl từng chapter để lấy URL ảnh và lưu vào DB
const pLimit = require('p-limit');
const { fetchPage } = require('../utils/http');
const { parseChapterImages } = require('../parsers/chapterParser');
const { bulkInsertImages, upsertChapter } = require('../db/models');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

const CONCURRENCY = parseInt(process.env.CRAWLER_CONCURRENCY) || 3;

/**
 * Crawl ảnh cho tất cả chapter chưa có ảnh (page_count = 0)
 */
async function crawlAllChapterImages(onProgress) {
  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let errors = 0;
  let totalImages = 0;

  // Lấy chapter chưa crawl ảnh
  const pending = await query(
    `SELECT c.id, c.manga_id, c.chapter_num, c.source_url, c.slug, m.title as manga_title
     FROM chapters c
     JOIN mangas m ON m.id = c.manga_id
     WHERE c.page_count = 0
     ORDER BY c.manga_id ASC, c.chapter_num ASC`
  );

  logger.info(`[ChapterCrawler] ${pending.length} chapters cần crawl ảnh`);
  if (pending.length === 0) return { processed: 0, errors: 0, totalImages: 0 };

  const tasks = pending.map((chapter) =>
    limit(async () => {
      try {
        const imageCount = await crawlOneChapter(chapter);
        processed++;
        totalImages += imageCount;
      } catch (e) {
        errors++;
        logger.error(
          `[ChapterCrawler] Lỗi chapter ${chapter.chapter_num} của "${chapter.manga_title}": ${e.message}`
        );
      }
      if (onProgress) {
        onProgress({ processed, errors, total: pending.length, totalImages });
      }
    })
  );

  await Promise.all(tasks);
  logger.info(
    `[ChapterCrawler] Xong! ${processed} chapters, ${totalImages} ảnh, ${errors} lỗi`
  );
  return { processed, errors, totalImages };
}

/**
 * Crawl một chapter cụ thể
 * @param {object} chapter - { id, manga_id, chapter_num, source_url, slug }
 * @returns {number} số ảnh đã lưu
 */
async function crawlOneChapter(chapter) {
  logger.debug(`[ChapterCrawler] Chapter ${chapter.chapter_num}: ${chapter.source_url}`);

  const html = await fetchPage(chapter.source_url);
  const images = parseChapterImages(html, chapter.source_url);

  if (images.length === 0) {
    logger.warn(
      `[ChapterCrawler] Chapter ${chapter.chapter_num} không có ảnh: ${chapter.source_url}`
    );
    return 0;
  }

  // Lưu ảnh vào DB
  await bulkInsertImages(chapter.id, chapter.manga_id, images);

  // Cập nhật page_count
  await upsertChapter({
    manga_id: chapter.manga_id,
    chapter_num: chapter.chapter_num,
    title: null,
    slug: chapter.slug,
    source_url: chapter.source_url,
    page_count: images.length,
  });

  logger.info(
    `[ChapterCrawler] ✓ Chapter ${chapter.chapter_num} → ${images.length} ảnh`
  );
  return images.length;
}

module.exports = { crawlAllChapterImages, crawlOneChapter };
