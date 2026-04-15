// src/db/models.js
// CRUD operations cho các bảng trong TiDB
const { query } = require('./connection');

// ─────────────────────────────────────────────
// MANGA
// ─────────────────────────────────────────────
async function upsertManga(data) {
  const sql = `
    INSERT INTO mangas
      (slug, title, alt_title, cover_url, description, status,
       author, artist, total_chapters, view_count, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title          = VALUES(title),
      alt_title      = VALUES(alt_title),
      cover_url      = VALUES(cover_url),
      description    = VALUES(description),
      status         = VALUES(status),
      author         = VALUES(author),
      artist         = VALUES(artist),
      total_chapters = VALUES(total_chapters),
      view_count     = VALUES(view_count),
      updated_at     = CURRENT_TIMESTAMP
  `;
  const result = await query(sql, [
    data.slug,
    data.title,
    data.alt_title || null,
    data.cover_url || null,
    data.description || null,
    data.status || null,
    data.author || null,
    data.artist || null,
    data.total_chapters || 0,
    data.view_count || 0,
    data.source_url,
  ]);

  // Lấy ID sau insert/update
  if (result.insertId && result.insertId > 0) return result.insertId;
  const rows = await query('SELECT id FROM mangas WHERE slug = ?', [data.slug]);
  return rows[0]?.id;
}

async function getMangaBySlug(slug) {
  const rows = await query('SELECT * FROM mangas WHERE slug = ?', [slug]);
  return rows[0] || null;
}

async function getMangaCount() {
  const rows = await query('SELECT COUNT(*) as cnt FROM mangas');
  return rows[0].cnt;
}

// ─────────────────────────────────────────────
// GENRES
// ─────────────────────────────────────────────
async function upsertGenre(name, slug) {
  await query(
    'INSERT INTO genres (name, slug) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
    [name, slug]
  );
  const rows = await query('SELECT id FROM genres WHERE slug = ?', [slug]);
  return rows[0]?.id;
}

async function linkMangaGenre(mangaId, genreId) {
  await query(
    'INSERT IGNORE INTO manga_genres (manga_id, genre_id) VALUES (?, ?)',
    [mangaId, genreId]
  );
}

// ─────────────────────────────────────────────
// CHAPTERS
// ─────────────────────────────────────────────
async function upsertChapter(data) {
  const sql = `
    INSERT INTO chapters
      (manga_id, chapter_num, title, slug, source_url, page_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title      = VALUES(title),
      slug       = VALUES(slug),
      source_url = VALUES(source_url),
      page_count = IF(VALUES(page_count) > 0, VALUES(page_count), page_count),
      updated_at = CURRENT_TIMESTAMP
  `;
  const result = await query(sql, [
    data.manga_id,
    data.chapter_num,
    data.title || null,
    data.slug,
    data.source_url,
    data.page_count || 0,
  ]);

  if (result.insertId && result.insertId > 0) return result.insertId;
  const rows = await query(
    'SELECT id FROM chapters WHERE manga_id = ? AND chapter_num = ?',
    [data.manga_id, data.chapter_num]
  );
  return rows[0]?.id;
}

async function getChaptersByMangaId(mangaId) {
  return query(
    'SELECT * FROM chapters WHERE manga_id = ? ORDER BY chapter_num ASC',
    [mangaId]
  );
}

async function isChapterCrawled(mangaId, chapterNum) {
  const rows = await query(
    'SELECT id, page_count FROM chapters WHERE manga_id = ? AND chapter_num = ?',
    [mangaId, chapterNum]
  );
  if (!rows[0]) return false;
  return rows[0].page_count > 0; // đã có ảnh
}

// ─────────────────────────────────────────────
// CHAPTER IMAGES
// ─────────────────────────────────────────────
async function bulkInsertImages(chapterId, mangaId, images) {
  if (!images || images.length === 0) return;

  // Xóa ảnh cũ nếu re-crawl
  await query('DELETE FROM chapter_images WHERE chapter_id = ?', [chapterId]);

  const values = images.map((img, idx) => [
    chapterId,
    mangaId,
    idx + 1,
    img.url,
    img.cdn || null,
  ]);

  // Batch insert từng nhóm 100 ảnh
  const batchSize = 100;
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
    const flat = batch.flat();
    await query(
      `INSERT INTO chapter_images (chapter_id, manga_id, page_num, img_url, img_cdn)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE img_url = VALUES(img_url)`,
      flat
    );
  }
}

async function getImagesByChapterId(chapterId) {
  return query(
    'SELECT * FROM chapter_images WHERE chapter_id = ? ORDER BY page_num ASC',
    [chapterId]
  );
}

async function getImageCount() {
  const rows = await query('SELECT COUNT(*) as cnt FROM chapter_images');
  return rows[0].cnt;
}

// ─────────────────────────────────────────────
// CRAWL QUEUE
// ─────────────────────────────────────────────
async function enqueue(type, url, mangaId = null, chapterId = null) {
  await query(
    `INSERT IGNORE INTO crawl_queue (type, url, manga_id, chapter_id)
     VALUES (?, ?, ?, ?)`,
    [type, url, mangaId, chapterId]
  );
}

async function getPendingQueue(type, limit = 10) {
  return query(
    `SELECT * FROM crawl_queue
     WHERE status = 'pending' AND type = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [type, limit]
  );
}

async function markQueueStatus(id, status, errorMsg = null) {
  await query(
    `UPDATE crawl_queue SET status = ?, error_msg = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, errorMsg, id]
  );
}

async function incrementRetry(id) {
  await query(
    'UPDATE crawl_queue SET retry_count = retry_count + 1 WHERE id = ?',
    [id]
  );
}

// ─────────────────────────────────────────────
// CRAWL SESSIONS
// ─────────────────────────────────────────────
async function createSession() {
  const result = await query(
    `INSERT INTO crawl_sessions (started_at, status) VALUES (NOW(), 'running')`
  );
  return result.insertId;
}

async function updateSession(id, stats) {
  await query(
    `UPDATE crawl_sessions
     SET mangas_crawled  = ?,
         chapters_crawled = ?,
         images_crawled  = ?,
         errors          = ?,
         status          = ?,
         ended_at        = ?
     WHERE id = ?`,
    [
      stats.mangas || 0,
      stats.chapters || 0,
      stats.images || 0,
      stats.errors || 0,
      stats.status || 'running',
      stats.ended_at || null,
      id,
    ]
  );
}

module.exports = {
  upsertManga, getMangaBySlug, getMangaCount,
  upsertGenre, linkMangaGenre,
  upsertChapter, getChaptersByMangaId, isChapterCrawled,
  bulkInsertImages, getImagesByChapterId, getImageCount,
  enqueue, getPendingQueue, markQueueStatus, incrementRetry,
  createSession, updateSession,
};
