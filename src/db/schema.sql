-- ================================================
-- VinHentai Crawler Database Schema (TiDB)
-- ================================================

CREATE DATABASE IF NOT EXISTS vinahentai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vinahentai;

-- ------------------------------------------------
-- Table: mangas
-- Lưu thông tin truyện tranh
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS mangas (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(500) NOT NULL UNIQUE COMMENT 'URL slug của truyện',
  title       VARCHAR(500) NOT NULL COMMENT 'Tên truyện',
  alt_title   VARCHAR(500) DEFAULT NULL COMMENT 'Tên khác',
  cover_url   TEXT         DEFAULT NULL COMMENT 'URL ảnh bìa',
  description TEXT         DEFAULT NULL COMMENT 'Mô tả truyện',
  status      VARCHAR(50)  DEFAULT NULL COMMENT 'Đang tiến hành / Hoàn thành',
  author      VARCHAR(255) DEFAULT NULL,
  artist      VARCHAR(255) DEFAULT NULL,
  total_chapters INT       DEFAULT 0,
  view_count  BIGINT       DEFAULT 0,
  source_url  TEXT         NOT NULL   COMMENT 'URL trang truyện gốc',
  crawled_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_slug (slug(191)),
  INDEX idx_crawled_at (crawled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: genres
-- Thể loại truyện
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS genres (
  id    INT          NOT NULL AUTO_INCREMENT,
  name  VARCHAR(100) NOT NULL UNIQUE,
  slug  VARCHAR(100) NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: manga_genres (many-to-many)
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS manga_genres (
  manga_id  BIGINT NOT NULL,
  genre_id  INT    NOT NULL,
  PRIMARY KEY (manga_id, genre_id),
  INDEX idx_genre_id (genre_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: chapters
-- Danh sách chapter của từng truyện
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  manga_id     BIGINT       NOT NULL,
  chapter_num  FLOAT        NOT NULL  COMMENT 'Số chapter (hỗ trợ chapter 1.5)',
  title        VARCHAR(500) DEFAULT NULL COMMENT 'Tên chapter nếu có',
  slug         VARCHAR(500) NOT NULL  COMMENT 'URL slug chapter',
  source_url   TEXT         NOT NULL,
  page_count   INT          DEFAULT 0 COMMENT 'Số trang / ảnh',
  crawled_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manga_chapter (manga_id, chapter_num),
  INDEX idx_manga_id (manga_id),
  INDEX idx_crawled_at (crawled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: chapter_images
-- URL ảnh từng trang của chapter
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS chapter_images (
  id          BIGINT NOT NULL AUTO_INCREMENT,
  chapter_id  BIGINT NOT NULL,
  manga_id    BIGINT NOT NULL,
  page_num    INT    NOT NULL COMMENT 'Thứ tự trang (1-indexed)',
  img_url     TEXT   NOT NULL COMMENT 'URL ảnh đầy đủ',
  img_cdn     TEXT   DEFAULT NULL COMMENT 'CDN URL nếu khác',
  PRIMARY KEY (id),
  UNIQUE KEY uq_chapter_page (chapter_id, page_num),
  INDEX idx_chapter_id (chapter_id),
  INDEX idx_manga_id (manga_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: crawl_queue
-- Hàng đợi và trạng thái crawl
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS crawl_queue (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  type        ENUM('manga_list', 'manga_detail', 'chapter') NOT NULL,
  url         TEXT         NOT NULL,
  status      ENUM('pending', 'processing', 'done', 'failed') DEFAULT 'pending',
  retry_count INT          DEFAULT 0,
  error_msg   TEXT         DEFAULT NULL,
  manga_id    BIGINT       DEFAULT NULL,
  chapter_id  BIGINT       DEFAULT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status_type (status, type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: crawl_sessions
-- Log từng phiên crawl
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS crawl_sessions (
  id              BIGINT    NOT NULL AUTO_INCREMENT,
  started_at      DATETIME  DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME  DEFAULT NULL,
  mangas_crawled  INT       DEFAULT 0,
  chapters_crawled INT      DEFAULT 0,
  images_crawled  INT       DEFAULT 0,
  errors          INT       DEFAULT 0,
  status          ENUM('running', 'done', 'failed') DEFAULT 'running',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
