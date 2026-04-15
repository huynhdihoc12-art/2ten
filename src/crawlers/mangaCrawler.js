// src/crawlers/mangaCrawler.js
// Crawl trang chi tiết từng truyện: metadata + danh sách chapter
const pLimit = require('p-limit');
const { fetchPage } = require('../utils/http');
const { parseMangaDetail } = require('../parsers/mangaParser');
const {
  getMangaCount,
  upsertManga,
  upsertGenre,
  linkMangaGenre,
  upsertChapter,
  getMangaBySlug,
} = require('../db/models');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

const CONCURRENCY = parseInt(process.env.CRAWLER_CONCURRENCY) || 3;

/**
 * Crawl chi tiết cho tất cả manga chưa có đủ chapter
 */
async function crawlAllMangaDetails(onProgress) {
  const limit = pLimit(CONCURRENCY);
  let processed = 0;
  let errors = 0;

  // Lấy danh sách manga chưa crawl chi tiết (total_chapters = 0)
  const pending = await query(
    `SELECT id, slug, source_url, title FROM mangas
     WHERE total_chapters = 0 OR total_chapters IS NULL
     ORDER BY id ASC`
  );

  logger.info(`[MangaCrawler] ${pending.length} truyện cần crawl chi tiết`);
  if (pending.length === 0) return { processed: 0, errors: 0 };

  const tasks = pending.map((manga) =>
    limit(async () => {
      try {
        await crawlOneManga(manga.slug, manga.source_url, manga.id);
        processed++;
      } catch (e) {
        errors++;
        logger.error(`[MangaCrawler] Lỗi "${manga.title}": ${e.message}`);
      }
      if (onProgress) onProgress({ processed, errors, total: pending.length });
    })
  );

  await Promise.all(tasks);
  logger.info(`[MangaCrawler] Xong! ${processed} thành công, ${errors} lỗi`);
  return { processed, errors };
}

/**
 * Crawl một truyện cụ thể theo slug
 */
async function crawlOneManga(slug, sourceUrl, existingMangaId = null) {
  logger.info(`[MangaCrawler] Crawling: ${slug}`);

  const html = await fetchPage(sourceUrl);
  const detail = parseMangaDetail(html, sourceUrl);

  if (!detail.title) {
    throw new Error(`Không parse được title từ ${sourceUrl}`);
  }

  // Upsert manga với đầy đủ thông tin
  const mangaId = await upsertManga({
    slug,
    title: detail.title,
    alt_title: detail.altTitle,
    cover_url: detail.coverUrl,
    description: detail.description,
    status: detail.status,
    author: detail.author,
    artist: detail.artist,
    total_chapters: detail.totalChapters,
    view_count: detail.viewCount,
    source_url: sourceUrl,
  });

  // Lưu genres
  for (const genre of detail.genres) {
    const genreId = await upsertGenre(genre.name, genre.slug);
    await linkMangaGenre(mangaId, genreId);
  }

  // Lưu danh sách chapter (stub - chưa có ảnh)
  for (const ch of detail.chapters) {
    await upsertChapter({
      manga_id: mangaId,
      chapter_num: ch.chapterNum,
      title: ch.title,
      slug: ch.slug,
      source_url: ch.sourceUrl,
      page_count: 0, // sẽ update sau khi crawl ảnh
    });
  }

  logger.info(
    `[MangaCrawler] ✓ "${detail.title}" - ${detail.chapters.length} chapters, ${detail.genres.length} genres`
  );

  return { mangaId, chapterCount: detail.chapters.length };
}

module.exports = { crawlAllMangaDetails, crawlOneManga };
