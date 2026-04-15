// src/parsers/chapterParser.js
// Parse trang chapter - vinahentai.me dùng React Router SSR
// Ảnh nằm trong window.__reactRouterContext.streamController.enqueue(...)
// Cụ thể trong field "contentUrls" của chapter data
const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * Parse trang chapter - trả về mảng { url, cdn }
 *
 * HTML structure của vinahentai.me:
 *  - Dùng React Router v7 với stream SSR
 *  - Data được enqueue qua: window.__reactRouterContext.streamController.enqueue(...)
 *  - Field "contentUrls" chứa array URL ảnh CDN
 *  - CDN: https://cdn.vinahentai.me/manga-images/{mangaId}/{chapNum}/{filename}.webp
 *  - Preload: <link rel="preload" as="image" href="...webp"> (chỉ ảnh đầu)
 */
function parseChapterImages(html, chapterUrl) {
  const images = [];
  const seen = new Set();

  // ── Phương pháp 1: Trích xuất từ stream data (CHÍNH) ──
  // Site enqueue JSON string qua streamController
  // Tất cả URL ảnh nằm sau key "contentUrls" trong chuỗi JSON
  const streamMatches = html.matchAll(/streamController\.enqueue\("([^"]+)"\)/g);
  let combinedStream = '';
  for (const m of streamMatches) {
    try {
      // Unescape chuỗi JSON string (đã được escape 2 lần)
      combinedStream += JSON.parse('"' + m[1] + '"');
    } catch {
      combinedStream += m[1];
    }
  }

  if (combinedStream) {
    // Tìm tất cả CDN URL trong chuỗi stream
    const cdnMatches = combinedStream.matchAll(
      /https?:\/\/cdn\.vinahentai\.me\/manga-images\/[^"\\,\]]+\.(?:webp|jpg|jpeg|png)/g
    );
    for (const m of cdnMatches) {
      const url = m[0];
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, cdn: url });
      }
    }
    logger.debug(`[ChapterParser] Stream parse → ${images.length} ảnh`);
  }

  // ── Phương pháp 2: Regex thẳng trên raw HTML (FALLBACK) ──
  // Tìm bất kỳ URL CDN manga-images nào trong HTML
  if (images.length === 0) {
    logger.debug('[ChapterParser] Thử regex scan HTML...');
    const rawMatches = html.matchAll(
      /https?:\\?\/\\?\/cdn\.vinahentai\.me\\?\/manga-images\\?\/[^"'<>\s\\]+\.(?:webp|jpg|jpeg|png)/g
    );
    for (const m of rawMatches) {
      // Normalize escaped slashes
      const url = m[0].replace(/\\\//g, '/');
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, cdn: url });
      }
    }
    logger.debug(`[ChapterParser] Regex scan → ${images.length} ảnh`);
  }

  // ── Phương pháp 3: Parse DOM img tags ──
  if (images.length === 0) {
    const $ = cheerio.load(html);
    logger.debug('[ChapterParser] Thử DOM img parser...');

    $('img[src*="cdn.vinahentai.me/manga-images"]').each((_, el) => {
      const url = $(el).attr('src') || '';
      if (url && !seen.has(url)) {
        seen.add(url);
        images.push({ url, cdn: url });
      }
    });

    // Link preload (chỉ có ảnh đầu)
    $('link[rel="preload"][as="image"][href*="manga-images"]').each((_, el) => {
      const url = $(el).attr('href') || '';
      if (url && !seen.has(url)) {
        seen.add(url);
        images.push({ url, cdn: url });
      }
    });
  }

  // Sắp xếp theo thứ tự tên file (số đầu trong tên file)
  images.sort((a, b) => {
    const numA = extractPageNum(a.url);
    const numB = extractPageNum(b.url);
    return numA - numB;
  });

  logger.info(`[ChapterParser] ${chapterUrl} → ${images.length} ảnh`);
  return images;
}

/**
 * Trích xuất số thứ tự trang từ URL ảnh
 * Pattern: /0001/0-timestamp-hash.webp → 0
 * Pattern: /0001/15-timestamp-hash.webp → 15
 */
function extractPageNum(url) {
  const match = url.match(/\/(\d+)-\d+-[a-f0-9]+\.(?:webp|jpg|png)$/);
  return match ? parseInt(match[1]) : 9999;
}

module.exports = { parseChapterImages };
