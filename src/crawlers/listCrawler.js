// src/crawlers/listCrawler.js
// Crawl trang danh sách để lấy tất cả slug truyện
// URL thực tế: https://vinahentai.me/danh-sach?page=N
const { fetchPage, BASE_URL } = require('../utils/http');
const { parseListPage } = require('../parsers/listParser');
const { upsertManga } = require('../db/models');
const logger = require('../utils/logger');


/**
 * URL trang danh sách
 * vinahentai.me: /danh-sach?page=N
 */
function buildListUrl(page) {
  return `${BASE_URL}/danh-sach?page=${page}`;
}

/**
 * Lấy số trang cuối từ HTML (từ React Router stream data)
 */
function parseMaxPage(html) {
  // Tìm format: "totalPages",581 hoặc \"totalPages\",581
  const m = html.match(/\\?"totalPages\\?"\s*[,\:]\s*(\d+)/);
  if (m) {
    return parseInt(m[1], 10);
  }

  // Fallback scan sâu vào mảng
  const tokenMatch = html.match(/\\?"totalPages\\?"([^A-Za-z]+)(\d+)/);
  if (tokenMatch) {
     const val = parseInt(tokenMatch[2], 10);
     if (val > 1 && val < 50000) return val;
  }

  return 1;
}

/**
 * Crawl toàn bộ trang listing, save manga stubs vào DB
 * @param {Function} onProgress - callback({ page, maxPage, saved, totalSaved })
 * @returns {number} số manga đã lưu
 */
async function crawlAllListPages(onProgress) {
  let totalSaved = 0;
  const START_PAGE = parseInt(process.env.CRAWLER_START_PAGE) || 1;
  const END_PAGE = parseInt(process.env.CRAWLER_END_PAGE) || 9999;

  logger.info(`[ListCrawler] Bắt đầu crawl từ trang ${START_PAGE}...`);

  // Bước 1: Load trang đầu để biết tổng số trang
  const firstUrl = START_PAGE === 1 ? `${BASE_URL}/danh-sach` : buildListUrl(START_PAGE);
  const firstHtml = await fetchPage(firstUrl);
  let maxPage = parseMaxPage(firstHtml);
  maxPage = Math.min(maxPage, END_PAGE);
  logger.info(`[ListCrawler] Tổng ${maxPage} trang cần crawl`);

  // Parse trang đầu
  const firstItems = parseListPage(firstHtml, firstUrl);
  totalSaved += await saveItems(firstItems);
  if (onProgress) onProgress({ page: START_PAGE, maxPage, saved: firstItems.length, totalSaved });

  // Duyệt từ trang 2 đến max
  for (let page = Math.max(2, START_PAGE + 1); page <= maxPage; page++) {
    const url = buildListUrl(page);
    try {
      const html = await fetchPage(url);
      const items = parseListPage(html, url);

      if (items.length === 0) {
        logger.warn(`[ListCrawler] Trang ${page} rỗng → dừng`);
        break;
      }

      const saved = await saveItems(items);
      totalSaved += saved;
      logger.info(`[ListCrawler] Trang ${page}/${maxPage}: +${saved} truyện (tổng: ${totalSaved})`);

      if (onProgress) onProgress({ page, maxPage, saved, totalSaved });
    } catch (e) {
      logger.error(`[ListCrawler] Lỗi trang ${page}: ${e.message}`);
    }
  }

  logger.info(`[ListCrawler] ✅ Hoàn thành! Tổng: ${totalSaved} truyện`);
  return totalSaved;
}

async function saveItems(items) {
  let count = 0;
  for (const item of items) {
    try {
      await upsertManga({
        slug: item.slug,
        title: item.title || item.slug,
        cover_url: item.coverUrl,
        source_url: item.sourceUrl,
      });
      count++;
    } catch (e) {
      logger.error(`[ListCrawler] DB lỗi (${item.slug}): ${e.message}`);
    }
  }
  return count;
}

module.exports = { crawlAllListPages };
