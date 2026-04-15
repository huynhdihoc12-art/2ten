require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Khởi tạo Pool kết nối TiDB
const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  port: parseInt(process.env.TIDB_PORT) || 4000,
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: process.env.TIDB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
});

// Template HTML chung cho toàn bộ web
const layout = (title, content) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer"> <!-- Chống chặn ảnh CDN (Anti-Hotlink Bypass) -->
  <title>${title} | HYUN2Ten</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #f43f5e;
      --accent-hover: #e11d48;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }
    a { color: inherit; text-decoration: none; transition: all 0.2s; }
    
    /* Header Navbar */
    header {
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 50;
      padding: 1rem 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    header h1 { font-weight: 800; font-size: 1.5rem; letter-spacing: -0.5px; }
    header h1 span { color: var(--accent); }

    main { max-width: 1200px; margin: 0 auto; padding: 2rem; }

    /* Grid layout cho danh sách truyện */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.5rem;
    }
    
    /* Card Truyện */
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.05);
      transition: transform 0.3s, box-shadow 0.3s;
      display: flex; flex-direction: column;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px -10px rgba(244, 63, 94, 0.3);
      border-color: rgba(244, 63, 94, 0.3);
    }
    .card-img {
      width: 100%; aspect-ratio: 2/3; object-fit: cover;
    }
    .card-content { padding: 1rem; flex: 1; display: flex; flex-direction: column; }
    .card-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-stats { margin-top: auto; font-size: 0.85rem; color: var(--text-muted); }

    /* Chi tiết truyện */
    .manga-header {
      display: flex; gap: 2rem; margin-bottom: 3rem;
      background: var(--card-bg); padding: 2rem; border-radius: 16px;
    }
    .manga-cover { width: 250px; border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .manga-info h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .badges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0; }
    .badge { background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;}
    .desc { color: var(--text-muted); max-height: 150px; overflow-y: auto; }

    /* Chapter List */
    .chapter-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;
    }
    .chapter-btn {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      padding: 1rem; border-radius: 8px; text-align: center;
      transition: all 0.2s; font-weight: 600;
    }
    .chapter-btn:hover { background: var(--accent); border-color: var(--accent); color: white; }

    /* Viewer Đọc Truyện */
    .viewer { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
    .viewer img { width: 100%; border-radius: 4px; background: #1e293b; min-height: 500px;}
    
    /* Back btn */
    .back-btn { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; color: var(--text-muted); }
    .back-btn:hover { color: white; }

    /* Bộ lọc nâng cao */
    .filter-section {
      background: var(--card-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 2rem;
    }
    .filter-tools { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filter-tools input[type="text"] {
      flex: 1; min-width: 200px; padding: 0.8rem 1.2rem;
      border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.5); color: white; outline: none;
      font-size: 1rem; font-family: inherit; transition: border-color 0.2s;
    }
    .filter-tools input[type="text"]:focus { border-color: var(--accent); }
    .filter-tools button {
      padding: 0.8rem 2rem; border-radius: 8px; border: none; background: var(--accent); color: white; font-weight: 600; cursor: pointer;
      font-family: inherit; font-size: 1rem; transition: background 0.2s; white-space: nowrap;
    }
    .filter-tools button:hover { background: var(--accent-hover); }
    
    .genre-cloud { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.5rem; }
    .genre-cloud label {
      cursor: pointer; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.85rem; 
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      transition: all 0.2s; user-select: none; display: flex; align-items: center; gap: 4px;
    }
    .genre-cloud input[type="checkbox"] { display: none; }
    .genre-cloud input[type="checkbox"]:checked + span { color: var(--accent); font-weight: 600; }
    .genre-cloud label:has(input:checked) { border-color: var(--accent); background: rgba(244, 63, 94, 0.1); }

    /* Phân Trang (Pagination) */
    .pagination {
      display: flex; justify-content: center; gap: 0.5rem; margin-top: 3rem; flex-wrap: wrap;
    }
    .pag-btn {
      padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
      background: var(--card-bg); font-weight: 600; transition: all 0.2s;
    }
    .pag-btn:hover { background: rgba(255,255,255,0.1); }
    .pag-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
    .pag-btn.disabled { opacity: 0.5; pointer-events: none; }

    /* Chapter navigation */
    .viewer-nav {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; margin: 1rem 0 1.5rem;
    }
    .nav-btn {
      padding: 0.6rem 1rem; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: var(--card-bg); font-weight: 600;
      transition: all 0.2s; min-width: 120px; text-align: center;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.1); }
    .nav-btn.disabled { opacity: 0.5; pointer-events: none; }
  </style>
</head>
<body>
  <header>
    <a href="/"><h1>HYUN<span>2Ten</span></h1></a>
  </header>
  <main>
    ${content}
  </main>
</body>
</html>
`;

// 1. Trang Chủ: Danh sách Manga (Có Lọc & Tìm Kiếm & Phân Trang)
app.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 40;
    const offset = (page - 1) * limit;

    const searchTerm = req.query.q ? req.query.q.trim() : '';
    // Thể loại có thể là chuỗi (1 cái) hoặc array (nhiều cái)
    const genreQuery = req.query.genre || [];
    const selectedGenres = Array.isArray(genreQuery) ? genreQuery : [genreQuery];

    const [allGenres] = await pool.query('SELECT name, slug FROM genres ORDER BY name ASC');
    const genreCloudHtml = allGenres.map(g => `
      <label>
        <input type="checkbox" name="genre" value="${g.slug}" ${selectedGenres.includes(g.slug) ? 'checked' : ''}>
        <span>${g.name}</span>
      </label>
    `).join('');

    let sqlCount = 'SELECT COUNT(m.id) as cnt FROM mangas m';
    let sqlData = 'SELECT m.* FROM mangas m';
    const params = [];
    const whereConditions = [];

    // Lọc theo tìm kiếm
    if (searchTerm) {
      whereConditions.push('m.title LIKE ?');
      params.push(`%${searchTerm}%`);
    }

    // Lọc nâng cao nhiều thể loại (BẮT BUỘC có TẤT CẢ các thể loại đã chọn - AND filter)
    if (selectedGenres.length > 0) {
      const placeholders = selectedGenres.map(() => '?').join(',');
      const genreCount = selectedGenres.length;
      whereConditions.push(`m.id IN (
        SELECT manga_id FROM manga_genres mg
        JOIN genres g ON mg.genre_id = g.id
        WHERE g.slug IN (${placeholders})
        GROUP BY manga_id
        HAVING COUNT(DISTINCT g.id) = ${genreCount}
      )`);
      params.push(...selectedGenres);
    }

    if (whereConditions.length > 0) {
      const whereStr = ' WHERE ' + whereConditions.join(' AND ');
      sqlCount += whereStr;
      sqlData += whereStr;
    }

    sqlData += ' ORDER BY m.updated_at DESC, m.id DESC LIMIT ? OFFSET ?';
    const queryParams = [...params, limit, offset];

    const [countRows] = await pool.query(sqlCount, params);
    const totalItems = countRows[0].cnt;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const [mangas] = await pool.query(sqlData, queryParams);

    const filterHtml = `
      <form class="filter-section" method="GET" action="/">
        <div class="filter-tools">
          <input type="text" name="q" placeholder="🔍 Tìm kiếm tên truyện..." value="${searchTerm}">
          <button type="submit">Lọc Kết Quả</button>
        </div>
        <details ${selectedGenres.length > 0 ? 'open' : ''}>
          <summary style="cursor: pointer; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem; user-select: none;">
            Lọc Thể Loại Nâng Cao ${selectedGenres.length > 0 ? `(${selectedGenres.length} đã chọn)` : ''} (Mũi tên xuống để mở rộng)
          </summary>
          <div class="genre-cloud">
            ${genreCloudHtml}
          </div>
        </details>
      </form>
    `;

    if (mangas.length === 0) {
      return res.send(layout('Trang Chủ', `
        ${filterHtml}
        <div style="text-align:center; padding: 5rem;">
          <h2 style="margin-bottom: 1rem;">Không tìm thấy truyện nào 😢</h2>
        </div>
      `));
    }

    // Grid Truyện
    const cardsHtml = mangas.map(m => `
      <a href="/manga/${m.id}" class="card">
        <img src="${m.cover_url || 'https://via.placeholder.com/200x300?text=No+Cover'}" class="card-img" alt="cover" loading="lazy">
        <div class="card-content">
          <div class="card-title">${m.title}</div>
          <div class="card-stats">
            👁️ ${m.view_count.toLocaleString()} &nbsp; | &nbsp; 📜 ${m.total_chapters} chaps
          </div>
        </div>
      </a>
    `).join('');

    const buildQueryString = (p) => {
      const sp = new URLSearchParams();
      sp.append('page', p);
      if (searchTerm) sp.append('q', searchTerm);
      selectedGenres.forEach(g => sp.append('genre', g));
      return '?' + sp.toString();
    };

    let paginationHtml = '<div class="pagination">';
    paginationHtml += `<a href="${buildQueryString(page - 1)}" class="pag-btn ${page <= 1 ? 'disabled' : ''}">« Trước</a>`;
    const startP = Math.max(1, page - 2);
    const endP = Math.min(totalPages, page + 2);
    for (let p = startP; p <= endP; p++) {
      paginationHtml += `<a href="${buildQueryString(p)}" class="pag-btn ${page === p ? 'active' : ''}">${p}</a>`;
    }
    paginationHtml += `<a href="${buildQueryString(page + 1)}" class="pag-btn ${page >= totalPages ? 'disabled' : ''}">Sau »</a>`;
    paginationHtml += '</div>';

    res.send(layout('Khám Phá', `
      ${filterHtml}
      <div class="grid">${cardsHtml}</div>
      ${paginationHtml}
    `));
  } catch (err) {
    res.status(500).send('Lỗi DB: ' + err.message);
  }
});

// 2. Trang Chi Tiết: Thông tin manga + Danh sách chapter
app.get('/manga/:id', async (req, res) => {
  try {
    const [mangaRows] = await pool.query('SELECT * FROM mangas WHERE id = ?', [req.params.id]);
    if (mangaRows.length === 0) return res.status(404).send('Không tìm thấy truyện!');
    const m = mangaRows[0];

    const [chapters] = await pool.query('SELECT * FROM chapters WHERE manga_id = ? ORDER BY chapter_num ASC', [req.params.id]);
    const [genres] = await pool.query(`
      SELECT g.name FROM genres g 
      JOIN manga_genres mg ON g.id = mg.genre_id 
      WHERE mg.manga_id = ?
    `, [req.params.id]);

    const genreBadges = genres.map(g => `<span class="badge">${g.name}</span>`).join('');
    const chapterLinks = chapters.map(c => `
      <a href="/chapter/${c.id}" class="chapter-btn">
        ${c.title}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px">${c.page_count} trang</div>
      </a>
    `).join('');

    res.send(layout(m.title, `
      <a href="/" class="back-btn">← Quay lại danh sách</a>
      <div class="manga-header">
        <img src="${m.cover_url}" class="manga-cover" alt="cover">
        <div class="manga-info">
          <h1>${m.title}</h1>
          <p style="color:var(--accent); font-weight:600; margin-bottom:0.5rem">${m.author || 'Đang cập nhật'}</p>
          <div class="badges">${genreBadges}</div>
          <p class="desc">${m.description || 'Không có mô tả'}</p>
        </div>
      </div>
      
      <h2 style="margin-bottom: 1.5rem">Danh sách chương (${chapters.length})</h2>
      <div class="chapter-grid">
        ${chapters.length ? chapterLinks : '<p style="grid-column: 1/-1; color: var(--text-muted)">Đang cào dữ liệu chapter...</p>'}
      </div>
    `));
  } catch (err) {
    res.status(500).send('Lỗi DB: ' + err.message);
  }
});

// 3. Trang Đọc: Xem ảnh chapter
app.get('/chapter/:id', async (req, res) => {
  try {
    const [chapRows] = await pool.query('SELECT * FROM chapters WHERE id = ?', [req.params.id]);
    if (chapRows.length === 0) return res.status(404).send('Chapter không tồn tại!');
    const c = chapRows[0];

    const [prevRows] = await pool.query(
      'SELECT id, title, chapter_num FROM chapters WHERE manga_id = ? AND chapter_num < ? ORDER BY chapter_num DESC LIMIT 1',
      [c.manga_id, c.chapter_num]
    );
    const [nextRows] = await pool.query(
      'SELECT id, title, chapter_num FROM chapters WHERE manga_id = ? AND chapter_num > ? ORDER BY chapter_num ASC LIMIT 1',
      [c.manga_id, c.chapter_num]
    );
    const prevChap = prevRows[0] || null;
    const nextChap = nextRows[0] || null;

    const [images] = await pool.query('SELECT * FROM chapter_images WHERE chapter_id = ? ORDER BY id ASC', [req.params.id]);

    const chapterNavHtml = `
      <div class="viewer-nav">
        ${prevChap ? `<a class="nav-btn" href="/chapter/${prevChap.id}">← Prev</a>` : '<span class="nav-btn disabled">← Prev</span>'}
        ${nextChap ? `<a class="nav-btn" href="/chapter/${nextChap.id}">Next →</a>` : '<span class="nav-btn disabled">Next →</span>'}
      </div>
    `;

    const imgsHtml = images.map(img => `
      <img src="${img.img_url}" loading="lazy" alt="page">
    `).join('');

    res.send(layout(c.title, `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <a href="/manga/${c.manga_id}" class="back-btn">← Quay lại truyện</a>
        <h3 style="color: var(--text-muted)">${c.title} - ${images.length} trang</h3>
      </div>

      ${chapterNavHtml}
      
      <div class="viewer">
        ${imgsHtml}
      </div>

      ${chapterNavHtml}
    `));
  } catch (err) {
    res.status(500).send('Lỗi DB: ' + err.message);
  }
});

// Support Vercel serverless / Local node start
if (require.main === module) {
  app.listen(port, () => {
    console.log(`\n🚀 Mini SQL Viewer đang chạy tại: http://localhost:${port}`);
    console.log('   Mở link trên bằng trình duyệt của bạn để xem thành quả nhé!\n');
  });
} else {
  module.exports = app;
}
