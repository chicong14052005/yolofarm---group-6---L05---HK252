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

| Tính năng                              | Mô tả                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Dashboard**                      | Giám sát cảm biến thời gian thực (nhiệt độ, độ ẩm, ánh sáng, độ ẩm đất) |
| **Điều khiển thiết bị**       | Bật/tắt bơm nước, đèn LED, servo từ xa                                             |
| **Lịch trình tưới tự động** | Lịch tưới theo ngày lặp lại, khoảng thời gian bắt đầu/kết thúc                |
| **AI Phát hiện sâu bệnh**      | Upload ảnh cây trồng → nhận diện sâu bệnh bằng AI                                 |
| **Thông báo**                    | Cảnh báo bất thường từ cảm biến và hệ thống                                     |
| **Quản lý người dùng**        | Phân quyền admin/user, ban/unban tài khoản                                             |
| **Cài đặt giao diện**          | Theme sáng/tối, màu chủ đạo, font chữ, bo góc tùy chỉnh                          |
| **Đa ngôn ngữ**                 | Hỗ trợ Tiếng Việt và Tiếng Anh                                                       |
| **Google OAuth**                   | Đăng nhập bằng tài khoản Google                                                      |

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
│   ├── public/                # Static assets (favicon, fonts, images)
│   └── src/
│       ├── components/        # Shared components (Sidebar, ...)
│       ├── context/           # React Context (Auth, Theme, Language)
│       ├── i18n/              # Đa ngôn ngữ (vi.json, en.json)
│       ├── pages/             # Trang: Dashboard, Control, Schedule, AI, ...
│       ├── services/          # API services (axios)
│       ├── types/             # TypeScript interfaces
│       └── utils/             # Tiện ích (themeUtils, ...)
├── server/                    # Node.js backend
│   ├── database/              # SQL schema, migration, seed
│   └── src/
│       ├── config/            # DB, MQTT, Auth config
│       ├── controllers/       # Route handlers
│       ├── middleware/         # Auth middleware
│       ├── models/            # Database models
│       ├── routes/            # Express routes
│       ├── services/          # Business logic (MQTT, cron, ...)
│       └── utils/             # Tiện ích
└── docs/                      # Tài liệu dự án
```

## Tech Stack

| Layer    | Công nghệ                                                          |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Chart.js, React Router, Socket.IO Client |
| Backend  | Node.js, Express, Socket.IO, MQTT, node-cron, Winston                |
| Database | MySQL 8 (mysql2)                                                     |
| Auth     | JWT, bcryptjs, Google OAuth 2.0                                      |
| IoT      | Adafruit IO (MQTT protocol)                                          |
| AI       | Computer Vision — Pest Detection                                    |
