# 🌾 YoloFarm — Smart Agriculture System with AI & IoT

YoloFarm là hệ thống nông nghiệp thông minh kết hợp **AI** và **IoT**, cho phép giám sát và điều khiển nông trại từ xa thông qua giao diện web hiện đại.

## Kiến trúc hệ thống

```
┌──────────────┐     HTTP/WS      ┌──────────────┐      MQTT       ┌──────────────────┐
│   React App  │ ◄──────────────► │  Express API  │ ◄────────────► │  Adafruit IO     │
│   (Vite)     │                  │  (Node.js)    │                │  (MQTT Broker)   │
└──────────────┘                  └──────┬───────┘                └──────────────────┘
                                         │                              │
                                         ▼                              ▼
                                  ┌──────────────┐              ┌──────────────────┐
                                  │    MySQL      │              │   Thiết bị IoT   │
                                  │   Database    │              │  (Pump, LED, ...) │
                                  └──────────────┘              └──────────────────┘
```

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Database**: MySQL (mysql2)
- **IoT**: Adafruit IO (MQTT)
- **AI**: Mô hình nhận diện sâu bệnh cây trồng

## Tính năng chính

| Tính năng                              | Mô tả                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Dashboard**                      | Giám sát cảm biến thời gian thực (nhiệt độ, độ ẩm, ánh sáng, độ ẩm đất)         |
| **Điều khiển thiết bị**       | Bật/tắt bơm nước, đèn LED, servo từ xa                                                     |
| **Lịch trình tưới tự động** | Lịch tưới theo ngày lặp lại, khoảng thời gian bắt đầu/kết thúc                        |
| **AI Phát hiện sâu bệnh**      | Upload ảnh cây trồng → nhận diện sâu bệnh bằng AI                                         |
| **Thông báo**                    | Cảnh báo bất thường từ cảm biến và hệ thống, xóa từng thông báo hoặc xóa tất cả |
| **Quản lý người dùng**        | Phân quyền admin/user, ban/unban, admin đổi tên/mật khẩu của bất kỳ user                 |
| **Hồ sơ cá nhân**              | Đổi tên hiển thị, mật khẩu, upload avatar lên Cloudinary                                   |
| **Cài đặt giao diện**          | Theme sáng/tối, màu chủ đạo, font chữ, bo góc tùy chỉnh                                  |
| **Chính sách bảo mật**         | Admin quản lý nội dung policy; dịch tự động sang VI/EN qua Google Translate                 |
| **Đa ngôn ngữ**                 | Hỗ trợ Tiếng Việt và Tiếng Anh, chuyển đổi từ sidebar                                    |
| **Google OAuth**                   | Đăng nhập bằng tài khoản Google                                                              |

## Adafruit IO Dashboard

Dữ liệu cảm biến và trạng thái thiết bị được đồng bộ qua **Adafruit IO MQTT**:

- **Feed**: https://io.adafruit.com/Chicong2005/public  (lưu ý: các thiết bị nằm trong mục feeds -> yolofarm/<feed_name>)
- **Dashboard**: https://io.adafruit.com/Chicong2005/dashboards/dhb-yolo-farm  (lưu ý: chỉ cấp quyền xem dashboard, muốn bật tắt thiết bị thì thực hiện trên giao diện)
- **Username**: `Chicong2005`
- **Feeds**: `temperature`, `humidity`, `soil-moisture`, `light`, `pump1`, `pump2`, `led-rgb`

## Cài đặt

### Yêu cầu

- Node.js >= 18
- pnpm (cài đặt ở bước 2)
- MySQL >= 8.0

### 1. Clone repository

```bash
git clone <repo-url>
cd yolofarm
```

### 2. Cài đặt pnpm (nếu chưa có)

```bash
npm install -g pnpm
```

### 3. Cài đặt dependencies

```bash
pnpm install
```

### 4. Thiết lập Database

```bash
# Tạo database, bảng và seed dữ liệu mẫu
mysql -u root -p < server/database/schema.sql
```

### 5. Cấu hình biến môi trường

Copy file mẫu và điền các thông số cần thiết:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Mở `server/.env` và điền vào các trường sau (giữ nguyên các trường còn lại):

```env
DB_PASSWORD=your_mysql_password

AIO_USERNAME=your_adafruit_username
AIO_KEY=aio_xxxxxxxxxxxxxxxxxxxx   # Lấy từ https://io.adafruit.com → My Key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cloudinary — dùng để lưu trữ avatar người dùng
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Mở `client/.env` và điền:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### 6. Chạy ứng dụng

```bash
# Chạy cả client và server cùng lúc
pnpm dev

# Hoặc chạy riêng lẻ
pnpm dev:client   # http://localhost:5173
pnpm dev:server   # http://localhost:5000
```

Mở trình duyệt và truy cập **http://localhost:5173** để sử dụng ứng dụng.

> **Tài khoản mặc định**: `admin` / `admin123`

## Cấu trúc thư mục

```
yolofarm/
├── client/                    # React frontend
│   ├── public/                # Static assets (favicon, fonts, images, flags)
│   └── src/
│       ├── components/        # Shared components (Sidebar với language dropdown, ...)
│       ├── context/           # React Context (Auth, Theme, Language)
│       ├── i18n/              # Đa ngôn ngữ (vi.json, en.json)
│       ├── pages/             # Trang: Dashboard, Control, Schedule, AI, Notifications, Settings, ...
│       ├── services/          # API services (axios)
│       ├── types/             # TypeScript interfaces
│       └── utils/             # Tiện ích (themeUtils, ...)
├── server/                    # Node.js backend
│   ├── database/              # SQL schema, migration scripts
│   └── src/
│       ├── config/            # DB, MQTT, Auth, Cloudinary config
│       ├── controllers/       # Route handlers (notification, user, profile, privacyPolicy, ...)
│       ├── middleware/        # Auth, role middleware
│       ├── models/            # Database models
│       ├── routes/            # Express routes
│       ├── services/          # Business logic (MQTT, cron, ...)
│       └── utils/             # Tiện ích
└── stitch/                    # AI model integration
```

## Tech Stack

| Layer    | Công nghệ                                                                      |
| -------- | -------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Chart.js, React Router, Socket.IO Client             |
| Backend  | Node.js, Express, Socket.IO, MQTT, node-cron, Winston                            |
| Database | MySQL 8 (mysql2)                                                                 |
| Auth     | JWT, bcryptjs, Google OAuth 2.0                                                  |
| IoT      | Adafruit IO (MQTT protocol)                                                      |
| AI       | Computer Vision — Pest Detection                                                |
| Storage  | Cloudinary (avatar upload, image hosting)                                        |
| i18n     | Google Translate API (`@iamtraction/google-translate`) — dịch Privacy Policy |

## API Endpoints chính

### Auth

| Method | Endpoint               | Mô tả                              |
| ------ | ---------------------- | ------------------------------------ |
| POST   | `/api/auth/login`    | Đăng nhập bằng username/password |
| POST   | `/api/auth/register` | Đăng ký tài khoản               |
| POST   | `/api/auth/google`   | Đăng nhập bằng Google OAuth      |

### Profile

| Method | Endpoint                  | Mô tả                                     |
| ------ | ------------------------- | ------------------------------------------- |
| PUT    | `/api/profile/username` | Đổi tên hiển thị (full_name)           |
| PUT    | `/api/profile/password` | Đổi mật khẩu (yêu cầu mật khẩu cũ) |
| PUT    | `/api/profile/avatar`   | Upload avatar lên Cloudinary               |

### Notifications

| Method | Endpoint                                       | Mô tả                                        |
| ------ | ---------------------------------------------- | ---------------------------------------------- |
| GET    | `/api/notifications?filter=all\|unread\|saved` | Lấy danh sách thông báo                    |
| PUT    | `/api/notifications/:id/read`                | Đánh dấu đã đọc                         |
| PUT    | `/api/notifications/read-all`                | Đánh dấu tất cả đã đọc                |
| PUT    | `/api/notifications/:id/save`                | Lưu/bỏ lưu thông báo                      |
| DELETE | `/api/notifications/:id`                     | Xóa một thông báo                          |
| DELETE | `/api/notifications/delete-all`              | Xóa tất cả thông báo của user hiện tại |
| DELETE | `/api/notifications/admin/delete-all`        | (Admin) Xóa theo userId hoặc xóa toàn bộ  |

### Privacy Policy

| Method | Endpoint                              | Mô tả                                |
| ------ | ------------------------------------- | -------------------------------------- |
| GET    | `/api/privacy-policy/active`        | Lấy policy đang active               |
| POST   | `/api/privacy-policy/:id/translate` | Dịch policy sang VI/EN, cache vào DB |

### Preferences

| Method | Endpoint             | Mô tả                                     |
| ------ | -------------------- | ------------------------------------------- |
| GET    | `/api/preferences` | Lấy preferences (theme, locale, font, ...) |
| PUT    | `/api/preferences` | Lưu preferences lên server                |

### Users (Admin)

| Method | Endpoint                | Mô tả                                  |
| ------ | ----------------------- | ---------------------------------------- |
| GET    | `/api/users`          | Danh sách tất cả users                |
| PATCH  | `/api/users/:id/ban`  | Ban/Unban user                           |
| PATCH  | `/api/users/:id/info` | Đổi tên/mật khẩu của user bất kỳ |
