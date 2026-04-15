# Vinahentai Auto Crawler & Web Viewer 🕷️📚

Hệ thống crawl tự động thông minh và ứng dụng trình diễn ảnh chất lượng cao, lưu trữ độc lập trên hệ sinh thái **TiDB Cloud Serverless** và tối ưu hoá giao diện trên **Vercel**.

---

## 🏗️ 1. Cấu Trúc Hệ Thống

- **Cơ sở dữ liệu (Database):** Toàn bộ truyện tranh (Manga), danh sách thể loại (Genres), Chaper, và link ảnh (Image URL) được bóc tách và lưu tự động vào **TiDB Cloud**.
- **Backend Crawler:** Bot cào dữ liệu được viết bằng **Node.js + Cheerio**. Nó được thiết kế "thông minh" giả lập trình duyệt, vượt qua các hệ thống React Router ẩn, đồng thời tự tránh trùng lặp dữ liệu trước khi đẩy vào SQL.
- **Frontend Viewer (Mini Web):** Web tĩnh đọc truyện sử dụng **Express.js**, tích hợp giao diện darkmode sang trọng.
    - Đã vượt rào bảo vệ (Anti-Hotlink) bằng thẻ `<meta name="referrer" content="no-referrer">`, đảm bảo ảnh tải trực tiếp bằng Vinahentai CDN cực nhanh và không bao giờ chết.

---

## 🛠️ 2. Cài Đặt Ban Đầu (Chạy Local)

**Bước 1: Cài thư viện**
Mở Terminal tại thư mục code, chạy dòng lệnh hệ thống:
```bash
npm install
```

**Bước 2: Cấu hình TiDB (.env)**
Tạo (hoặc sửa đổi) tệp `.env` chứa những cấu hình TiDB cung cấp (lấy từ *TiDB Cloud → Cluster → Connect → Node.js*):
```env
TIDB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=[USER_CỦA_BẠN]
TIDB_PASSWORD=[PASS_CỦA_BẠN]
TIDB_DATABASE=vinahentai
TIDB_SSL=true
```

**Bước 3: Khởi tạo các Bảng (Tables)**
```bash
npm run setup
```

---

## 🔄 3. Vận Hành Hàng Ngày & Quản Trị

Thay vì việc phải đi cào liên tục bị cấm tài khoản, hệ thống có 2 lệnh thu thập cốt lõi cực kỳ tiết kiệm bộ nhớ:

**A. Cập nhật truyện mới hàng ngày (ĐỀ XUẤT ✅)**
```bash
npm run crawl:sync
```
> **Chức năng:** Lệnh này chỉ đi lấy **120 truyện mới nhất (3 trang đầu)** đăng trên web Vinahentai và đem đối chiếu với Database của bạn. Nếu trên web vừa có chap mới, hệ thống auto phát hiện và chỉ tải phần bù của nội dung đó về. 

**B. Cào lại toàn bộ (Dành cho việc tạo DB mới tinh)**
```bash
npm run crawl:all
```

**C. Xem tiến độ / Thống kê DB**
```bash
npm run status
```

---

## 🌐 4. Push lên GitHub & Host lên Vercel

Dự án này được thiết kế theo format chuẩn tương thích 100% với môi trường Vercel (đã có sẵn file `vercel.json` định tuyến tự động).

1. Bạn chỉ cần **Push Code** thư mục này lên GitHub cá nhân (file `.gitignore` đã chặn các thư mục không cần thiết).
2. Vào trang quản lý **Vercel.com**, nhấp `Add New Project` và kéo tải kho lưu trữ Github đó về.
3. ⚠️ **BƯỚC BẮT BUỘC:** Vào **Settings → Environment Variables** của dự án ở thẻ Vercel và gán 1-1 lại tất cả các biến liên quan tới `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`, `TIDB_SSL` (giống y hệt trên file `.env` Local của bạn)
4. Ấn **Lưu** và tiến hành **Deploy**.

Sau khi Vercel Deploy hoàn tất, Website tự động load ra những dữ liệu mới nhất mà chiếc PC / Laptop của bạn cào được thông qua lệnh `npm run crawl:sync`. Giao diện Frontend trên Vercel lo phục vụ khán giả duyệt Web hoàn toàn miễn phí, Server trên PC bạn chịu trách nhiệm tìm Data tống vào kho.
