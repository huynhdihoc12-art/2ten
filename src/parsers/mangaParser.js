// src/parsers/mangaParser.js
// Parse trang chi tiết truyện - vinahentai.me dùng React Router SSR
// Data nằm trong window.__reactRouterContext.streamController.enqueue(...)
const cheerio = require('cheerio');
const logger = require('../utils/logger');

const BASE_URL = process.env.TARGET_BASE_URL || 'https://vinahentai.me';

/**
 * Parse trang chi tiết manga
 * Thứ tự ưu tiên:
 *  1. Stream data từ React Router SSR (chính xác nhất)
 *  2. DOM parsing (fallback)
 */
function parseMangaDetail(html, sourceUrl) {
  // ── 1. Thử parse từ stream data ──
  const streamResult = parseFromStream(html, sourceUrl);
  if (streamResult && streamResult.title) {
    logger.info(`[MangaParser] Stream → "${streamResult.title}" - ${streamResult.chapters.length} chapters`);
    return streamResult;
  }

  // ── 2. Fallback: DOM parsing ──
  logger.warn(`[MangaParser] Stream parse thất bại, thử DOM...`);
  return parseMangaFromDOM(html, sourceUrl);
}

/**
 * Parse từ React Router stream data
 * Site enqueue JSON string: streamController.enqueue("...escaped JSON...")
 */
function parseFromStream(html, sourceUrl) {
  // Ghép tất cả các enqueue calls thành 1 chuỗi lớn
  const streamMatches = html.matchAll(/streamController\.enqueue\("([^"]+)"\)/g);
  let combinedStream = '';
  for (const m of streamMatches) {
    try {
      combinedStream += JSON.parse('"' + m[1] + '"');
    } catch {
      combinedStream += m[1];
    }
  }

  if (!combinedStream) return null;

  try {
    // Tìm title của manga
    const titleMatch = combinedStream.match(/"title"\s*,\s*"([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : null;
    if (!title) return null;

    // Tìm cover
    const coverMatch = combinedStream.match(/"coverUrl"\s*,\s*"(https?:[^"]+)"/);
    const coverUrl = coverMatch ? coverMatch[1].replace(/\\\//g, '/') : null;

    // Tìm description
    const descMatch = combinedStream.match(/"description"\s*,\s*"([^"]{10,})"/);
    const description = descMatch ? descMatch[1] : null;

    // Tìm status
    const statusMatch = combinedStream.match(/"status"\s*,\s*"([^"]+)"/);
    const status = statusMatch ? statusMatch[1] : null;

    // Tìm author
    const authorMatch = combinedStream.match(/"author"\s*,\s*"([^"]+)"/);
    const author = authorMatch ? authorMatch[1] : null;

    // Tìm view count
    const viewMatch = combinedStream.match(/"viewNumber"\s*,\s*(\d+)/);
    const viewCount = viewMatch ? parseInt(viewMatch[1]) : 0;

    // Tìm danh sách chapter
    // Trong stream, chapterList có dạng: "chapterList",[{...},{...}]
    // Mỗi chapter có: "title","Chap X","chap-X","chapterNumber",X
    const chapters = [];
    const chapterPattern = /"chapterNumber"\s*,\s*([\d.]+)[^}]+"title"\s*,\s*"([^"]+)"/g;
    // Thử pattern ngược lại
    const chapterPattern2 = /"title"\s*,\s*"(Chap\s+[\d.]+)"[^,]*,"([^"]+)"\s*,\s*"chap-[\d.]+"/g;

    // Extract tất cả chapter slugs và numbers
    const chapSlugs = [...combinedStream.matchAll(/"(chap-[\d.]+)"/g)].map(m => m[1]);
    const chapNums = [...combinedStream.matchAll(/"chapterNumber"\s*,\s*([\d.]+)/g)].map(m => parseFloat(m[1]));

    const mangaSlug = sourceUrl.split('/').filter(Boolean).pop();

    // Kết hợp slug và số chapter
    const uniqueSlugs = [...new Set(chapSlugs)];
    uniqueSlugs.forEach((slug, i) => {
      const num = chapNums[i] !== undefined ? chapNums[i] : (i + 1);
      chapters.push({
        chapterNum: num,
        title: `Chap ${num}`,
        slug,
        sourceUrl: `${BASE_URL}/truyen-hentai/${mangaSlug}/${slug}`,
      });
    });

    // Tìm genres từ stream (dựa trên manga_genres nếu có, hoặc từ DOM)
    const genres = parseGenresFromDOM(html);

    return {
      title,
      altTitle: null,
      coverUrl,
      description,
      status,
      author,
      artist: null,
      viewCount,
      totalChapters: chapters.length,
      genres,
      chapters: chapters.sort((a, b) => a.chapterNum - b.chapterNum),
    };
  } catch (e) {
    logger.warn(`[MangaParser] Lỗi parse stream: ${e.message}`);
    return null;
  }
}

/**
 * Parse genres từ DOM (genres luôn render trong HTML)
 */
function parseGenresFromDOM(html) {
  const $ = cheerio.load(html);
  const genres = [];
  $('a[href*="/genres/"]').each((_, el) => {
    const name = $(el).text().trim();
    const href = $(el).attr('href') || '';
    const slug = href.split('/').filter(Boolean).pop();
    if (name && slug && !genres.find(g => g.slug === slug)) {
      genres.push({ name, slug });
    }
  });
  return genres;
}

/**
 * Fallback: Parse manga từ DOM HTML
 */
function parseMangaFromDOM(html, sourceUrl) {
  const $ = cheerio.load(html);
  const mangaSlug = sourceUrl.split('/').filter(Boolean).pop();

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().replace(/[-|].*$/, '').trim();

  const coverUrl = $('meta[property="og:image"]').attr('content') || null;
  const description = $('meta[property="og:description"]').attr('content') || null;

  const genres = parseGenresFromDOM(html);

  // Chapter links
  const chapters = [];
  $(`a[href*="/truyen-hentai/${mangaSlug}/chap-"]`).each((_, el) => {
    const href = $(el).attr('href') || '';
    const numMatch = href.match(/chap-([\d.]+)/);
    if (!numMatch) return;
    const num = parseFloat(numMatch[1]);
    const slug = `chap-${numMatch[1]}`;
    const chUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    if (!chapters.find(c => c.chapterNum === num)) {
      chapters.push({ chapterNum: num, title: `Chap ${num}`, slug, sourceUrl: chUrl });
    }
  });

  logger.info(`[MangaParser][DOM] "${title}" → ${chapters.length} chapters`);

  return {
    title,
    altTitle: null,
    coverUrl,
    description,
    status: null,
    author: null,
    artist: null,
    viewCount: 0,
    totalChapters: chapters.length,
    genres,
    chapters: chapters.sort((a, b) => a.chapterNum - b.chapterNum),
  };
}

module.exports = { parseMangaDetail };
