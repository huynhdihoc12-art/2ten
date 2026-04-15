// src/utils/http.js
// HTTP client với retry, delay, và headers giả browser
const axios = require('axios');
const logger = require('./logger');

const BASE_URL = process.env.TARGET_BASE_URL || 'https://vinahentai.me';
const MAX_RETRIES = parseInt(process.env.CRAWLER_MAX_RETRIES) || 3;
const DELAY_MS = parseInt(process.env.CRAWLER_DELAY_MS) || 1500;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  Referer: BASE_URL,
};

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: HEADERS,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url, retries = 0) {
  try {
    await sleep(DELAY_MS + Math.random() * 500); // jitter
    const response = await client.get(url, {
      // override baseURL nếu url là absolute
      baseURL: url.startsWith('http') ? '' : BASE_URL,
    });
    return response.data;
  } catch (err) {
    const status = err.response?.status;
    logger.warn(`[HTTP] Lỗi ${status || err.code} khi tải: ${url} (lần ${retries + 1})`);

    if (retries < MAX_RETRIES) {
      const backoff = (retries + 1) * 3000;
      logger.info(`[HTTP] Thử lại sau ${backoff}ms...`);
      await sleep(backoff);
      return fetchPage(url, retries + 1);
    }

    throw new Error(`Không thể tải trang sau ${MAX_RETRIES} lần: ${url} - ${err.message}`);
  }
}

module.exports = { fetchPage, sleep, BASE_URL };
