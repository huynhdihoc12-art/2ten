// src/parsers/listParser.js
// Parse trang danh sách truyện (listing page) - vinahentai.me
const cheerio = require('cheerio');
const logger = require('../utils/logger');

const BASE_URL = process.env.TARGET_BASE_URL || 'https://vinahentai.me';

/**
 * Parse trang danh sách truyện từ HTML
 * Selector thực tế từ vinahentai.me:
 *   - Card: a.group.bg-bgc-layer1
 *   - Title: h3 bên trong card
 *   - Cover: background-image trong style của div con đầu tiên
 * Trả về mảng { slug, title, coverUrl, sourceUrl }
 */
function parseListPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const items = [];

  // ── Primary selector (vinahentai.me thực tế) ──
  let $items = $('a.group');

  // Fallback selectors nếu site thay đổi layout
  if ($items.length === 0) {
    const fallbacks = [
      'a[href*="/truyen-hentai/"]:has(h3)',
      'a[href*="/truyen-hentai/"]:has(img)',
      '.list-truyen .item a',
      '.items .item a',
      'article.item a',
    ];
    for (const sel of fallbacks) {
      $items = $(sel);
      if ($items.length > 0) {
        logger.debug(`[ListParser] Fallback selector: ${sel} → ${$items.length} items`);
        break;
      }
    }
  }

  // Fallback cuối: scan tất cả link /truyen-hentai/
  if ($items.length === 0) {
    logger.warn(`[ListParser] Không tìm được card, dùng link scan fallback`);
    const seen = new Set();
    $('a[href*="/truyen-hentai/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Chỉ lấy link trang truyện, không phải chapter
      if (href.match(/\/truyen-hentai\/[^/]+\/?$/) && !seen.has(href)) {
        seen.add(href);
        const sourceUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        const slug = href.split('/').filter(Boolean).pop();
        items.push({ slug, title: slug, coverUrl: null, sourceUrl });
      }
    });
    logger.info(`[ListParser] ${pageUrl} → ${items.length} truyện (fallback)`);
    return items;
  }

  $items.each((_, el) => {
    try {
      const $el = $(el);

      // Lấy href từ chính thẻ a (card là thẻ a)
      let href = $el.attr('href') || '';
      if (!href || !href.includes('/truyen-hentai/')) return;

      const sourceUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const slug = href.split('/').filter(Boolean).pop();

      // Lấy tiêu đề từ h3
      const title =
        $el.find('h3').first().text().trim() ||
        $el.find('h2, .title, .name').first().text().trim() ||
        $el.attr('title') ||
        slug;

      // Cover: background-image trong style của div con đầu tiên
      let coverUrl = null;
      const $firstDiv = $el.children('div').first();
      const styleStr = $firstDiv.attr('style') || '';
      const bgMatch = styleStr.match(/background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/);
      if (bgMatch) {
        coverUrl = bgMatch[1];
      } else {
        // Fallback: img tag
        const $img = $el.find('img').first();
        coverUrl =
          $img.attr('data-src') ||
          $img.attr('data-lazy-src') ||
          $img.attr('src') ||
          null;
      }

      if (slug && sourceUrl) {
        items.push({ slug, title, coverUrl, sourceUrl });
      }
    } catch (e) {
      logger.debug(`[ListParser] Lỗi parse item: ${e.message}`);
    }
  });

  logger.info(`[ListParser] ${pageUrl} → ${items.length} truyện`);
  return items;
}

/**
 * Lấy số trang cuối cùng từ pagination
 */
function parseMaxPage(html) {
  const $ = cheerio.load(html);

  // Tìm link pagination
  const pageNums = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const match = href.match(/[?&]page=(\d+)/) || text.match(/^(\d+)$/);
    if (match) pageNums.push(parseInt(match[1]));
  });

  // Tìm trong text của pagination buttons
  $('[class*="page"] a, .pagination a, nav a').each((_, el) => {
    const text = $(el).text().trim();
    if (/^\d+$/.test(text)) pageNums.push(parseInt(text));
  });

  return pageNums.length > 0 ? Math.max(...pageNums) : 1;
}

module.exports = { parseListPage, parseMaxPage };
