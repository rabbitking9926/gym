# Gym & TPBS – Node.js + Express + MongoDB

Bản có backend thật: giao diện (HTML/CSS/JS) gọi API Express, dữ liệu lưu trong MongoDB bằng Mongoose.
Gồm Sprint 1–4: đăng ký/đăng nhập, hồ sơ + BMI, gói tập, cửa hàng, điểm danh, EXP, huy hiệu (dùng huy hiệu giảm tối đa 30% gói tập).

## Chạy
Cần Node.js 18+ và MongoDB (cài local hoặc dùng MongoDB Atlas miễn phí).
```bash
npm install
cp .env.example .env        # chỉnh MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm start                   # http://localhost:3000
npm test                    # cần MongoDB đang chạy; test dùng database riêng rồi xóa đi
```
Lần chạy đầu tự tạo: cấu hình thưởng, tài khoản Admin (theo `.env`), 4 gói tập, 4 sản phẩm, 3 huy hiệu.
Mật khẩu Admin chỉ được đặt lúc tạo; đổi `ADMIN_PASSWORD` sau đó không có tác dụng với tài khoản đã tồn tại.

## Cấu trúc
```
server/
  index.js        khởi động, middleware, phục vụ thư mục public
  models.js       schema Mongoose: User, Plan, Sub, Product, Order, Badge, Checkin, ExpLog, Health, Config
  logic.js        luật nghiệp vụ: BMI, EXP, huy hiệu, kiểm tra dữ liệu
  middleware.js   đọc cookie đăng nhập, requireLogin / requireAdmin
  serialize.js    chuyển document thành JSON cho giao diện (không lộ mật khẩu)
  seed.js         dữ liệu khởi tạo
  routes/         auth.js, state.js, member.js, admin.js
public/           giao diện: index.html, css/, js/ (api.js gọi máy chủ)
test/api.test.js  10 nhóm kiểm thử API với MongoDB thật
```

## API chính
| Phương thức | Đường dẫn | Quyền |
|---|---|---|
| POST | `/api/register`, `/api/login`, `/api/logout` | công khai |
| GET | `/api/state` | dữ liệu theo vai trò (hội viên chỉ thấy của mình) |
| PUT | `/api/profile` | đăng nhập |
| POST | `/api/plans/subscribe` `{id, use}` | đăng nhập |
| POST | `/api/cart/add`, `/api/cart/set`, `/api/checkout`, `/api/orders/:id/cancel` | đăng nhập |
| POST | `/api/checkin` | đăng nhập |
| POST/PUT/DELETE | `/api/admin/:kind` (plans, products, badges), `/api/admin/orders/:id/status`, `/api/admin/config` | Admin |

## Những điểm đáng chú ý
- **Mật khẩu**: bcrypt. **Đăng nhập**: JWT trong cookie httpOnly (SameSite=Lax), vai trò đọc lại từ database mỗi request.
- **Giá, tồn kho, giảm giá, EXP** đều do máy chủ tính; giao diện không thể tự đặt giá hay EXP.
- **Chống lỗi đồng thời** nhờ tính năng của MongoDB: trừ kho bằng `findOneAndUpdate` có điều kiện `ton >= qty` (2 người mua món cuối chỉ 1 người thành công); index unique `(user, date)` cho điểm danh 1 lần/ngày; index unique một gói `Active`/hội viên.
- Chặn NoSQL injection (chỉ nhận chuỗi ở email/mật khẩu), giới hạn đăng nhập sai 10 lần/15 phút (bộ nhớ tiến trình, chạy nhiều instance thì cần Redis).
- Ngày điểm danh/hạn gói tính theo giờ Việt Nam (UTC+7) trong `server/logic.js`.
- Chạy sau HTTPS thì đặt `COOKIE_SECURE=true`.
- Chưa có: thanh toán thật (chỉ mô phỏng), quên mật khẩu, phân trang cho danh sách lớn, upload ảnh sản phẩm.
