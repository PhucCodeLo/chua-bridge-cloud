# Cầu nối mây — Chùa Online TikTok LIVE

Máy chủ cầu nối chạy trên mây (Render free) để buổi live TikTok **không cần TikTool, không giới hạn số lần nối**:

- `server.js` dùng `tiktok-live-connector` nối thẳng vào phòng live TikTok (ký qua Euler bằng key miễn phí nếu có `EULER_API_KEY`, không có vẫn thử nối trực tiếp).
- Chỉ nối TikTok khi có trình duyệt đang mở trang chùa; vắng khách 2 phút là tự ngắt cho đỡ tốn tài nguyên.
- Phục vụ luôn trang chùa tại `www/` (ảnh nền/sprite lấy từ bản Vercel chính nên repo nhẹ, toàn file chữ).

## Chạy trên Render

Repo đã có sẵn `render.yaml` (plan free, build `npm install`, start `npm start`):

- Render Dashboard → **New → Blueprint** → chọn repo này → Apply.
- Biến môi trường: `TIKTOK_USER=cuocsongvuituoihehe` (đã khai trong render.yaml), `EULER_API_KEY` tùy chọn.

## Cách dùng mỗi buổi live

1. Mở địa chỉ service (dạng `https://chua-bridge.onrender.com`) trước ~1 phút cho máy chủ thức dậy (gói free ngủ khi không ai dùng).
2. Mở `https://chua-bridge.onrender.com/?live=1` trên điện thoại, để Chrome ở trước mặt.
3. Bấm Phát LIVE trên TikTok (chế độ Trò chơi di động) — khách vào, bình luận, tặng quà sẽ hiện trong chùa theo thời gian thực.

Kiểm tra sức khỏe: `GET /health` trả JSON trạng thái kết nối.
