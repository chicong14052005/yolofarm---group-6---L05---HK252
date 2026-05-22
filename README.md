# 🌾 YoloFarm — Smart Agriculture System with AI & IoT

YoloFarm là hệ thống nông nghiệp thông minh kết hợp **AI** và **IoT**, cho phép giám sát và điều khiển nông trại từ xa thông qua giao diện web hiện đại.

## Kiến trúc hệ thống

```
┌──────────────┐     HTTP/WS      ┌──────────────┐      MQTT      ┌──────────────────┐
│   React App  │ ◄──────────────► │  Express API │ ◄────────────► │  Adafruit IO     │
│   (Vite)     │                  │  (Node.js)   │                │  (MQTT Broker)   │
└──────────────┘                  └──────┬───────┘                └──────────────────┘
                                         │       │                       │
                                         │       ▼                       ▼
                                         │  ┌──────────────┐      ┌──────────────────┐
                                         │  │  FastAPI     │      │   Thiết bị IoT   │
                                         │  │  (Python AI) │      │  (Pump, LED, ...)│
                                         │  │  Port 8000   │      └──────────────────┘
                                         │  └──────────────┘
                                         ▼
                                  ┌──────────────┐
                                  │    MySQL     │
                                  │   Database   │
                                  └──────────────┘
```

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.IO
- **AI API**: FastAPI + TensorFlow/Keras + PyTorch (Python 3.10–3.12)
- **Database**: MySQL (mysql2)
- **IoT**: Adafruit IO (MQTT)
- **AI Model**: EfficientNet nhận diện bệnh lá cà chua và GRU dự báo độ ẩm

## Tính năng chính

| Tính năng                              | Mô tả                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Dashboard**                      | Giám sát cảm biến thời gian thực (nhiệt độ, độ ẩm, ánh sáng, độ ẩm đất)                 |
| **Điều khiển thiết bị**       | Bật/tắt bơm nước, đèn LED từ xa                                                                    |
| **Lịch trình tưới tự động** | Lịch tưới theo ngày lặp lại, khoảng thời gian bắt đầu/kết thúc                                |
| **AI Phát hiện sâu bệnh**      | Upload ảnh lá cây → mô hình AI nhận diện bệnh, trả về tên bệnh, giải pháp và độ tin cậy |
| **Thông báo**                    | Cảnh báo bất thường từ cảm biến và hệ thống, xóa từng thông báo hoặc xóa tất cả         |
| **Quản lý người dùng**        | Phân quyền admin/user, ban/unban, admin đổi tên/mật khẩu của bất kỳ user                         |
| **Hồ sơ cá nhân**              | Đổi tên hiển thị, mật khẩu, upload avatar lên Cloudinary                                           |
| **Cài đặt giao diện**          | Theme sáng/tối, màu chủ đạo, font chữ, bo góc tùy chỉnh                                          |
| **Chính sách bảo mật**         | Admin quản lý nội dung policy; dịch tự động sang VI/EN qua Google Translate                         |
| **Đa ngôn ngữ**                 | Hỗ trợ Tiếng Việt và Tiếng Anh, chuyển đổi từ sidebar                                            |
| **Google OAuth**                   | Đăng nhập bằng tài khoản Google                                                                      |

## Các chức năng bổ sung

- **Bảng lịch sử độ ẩm 7 ngày**: hiển thị trung bình độ ẩm thực tế, độ ẩm dự đoán từ lần cập nhật dự báo mới nhất trong ngày, sai lệch và lý do thiếu dữ liệu.
- **Export CSV**: bảng lịch sử độ ẩm có thể xuất CSV.
- **Chạy một lệnh bằng `pnpm dev`**: tự kiểm tra schema, tạo Python venv nếu thiếu, cài AI dependencies và chạy client/server/FastAPI.
- **Chạy full stack bằng Docker Compose**: có thể chạy MySQL, Express, FastAPI AI và React/Nginx bằng Docker.

## Adafruit IO Dashboard

Dữ liệu cảm biến và trạng thái thiết bị được đồng bộ qua **Adafruit IO MQTT**:

- **Feed**: https://io.adafruit.com/Chicong2005/public (lưu ý: các thiết bị nằm trong mục feeds -> yolofarm/<feed_name>)
- **Dashboard**: https://io.adafruit.com/Chicong2005/dashboards/dhb-yolo-farm (lưu ý: chỉ cấp quyền xem dashboard, muốn bật tắt thiết bị thì thực hiện trên giao diện)
- **Username**: `Chicong2005`
- **Feeds**: `temperature`, `humidity`, `soil-moisture`, `light`, `pump1`, `pump2`, `led-rgb`

## Cài đặt

### Yêu cầu

- Node.js >= 18
- **Python >= 3.10 và <= 3.12** (cần cho AI Pest Detection — TensorFlow không hỗ trợ Python 3.13+)
- pnpm (cài đặt ở bước 2)
- MySQL >= 8.0
- Docker Desktop + Docker Compose (nếu chạy toàn bộ bằng Docker)

> **Lưu ý về Python**: Trên Windows, nên cài Python từ [python.org](https://www.python.org/downloads/) (chọn "Add Python to PATH"). Hệ thống sẽ tự tìm phiên bản phù hợp thông qua `py -3.12`, `py -3.11`, hoặc `py -3.10`.

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

# Nạp dữ liệu cảm biến cho bảng sensor_data
mysql -u root -p yolofarm < server/database/sensor_data_merged_ordered.sql

# Nạp lịch sử dự báo cho bảng forecast_history
mysql -u root -p yolofarm < server/database/forecast_history_202605221245.sql
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

AIO_USERNAME=your_adafruit_username <đã có sẵn trong .env.example>
AIO_KEY=aio_xxxxxxxxxxxxxxxxxxxx   # Lấy từ https://io.adafruit.com → My Key <đã gửi vô nhóm zalo>

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

### 6. Chạy ứng dụng (Chạy bằng pnpm hoặc docker)

```bash
# Chạy cả 3 service cùng lúc (Client + Server + AI API)
pnpm dev

# Hoặc chạy riêng lẻ
pnpm dev:client   # http://localhost:5173
pnpm dev:server   # http://localhost:5000
pnpm dev:api      # http://localhost:8000/docs
```

Mở trình duyệt và truy cập **http://localhost:5173** để sử dụng ứng dụng.

> **Tài khoản mặc định**: `admin` / `admin123`

#### Cơ chế chạy tự động (`pnpm dev`)

Khi chạy `pnpm dev`, hệ thống sử dụng [`concurrently`](https://www.npmjs.com/package/concurrently) để khởi động **3 service song song**:

| Service      | Port | Công nghệ       | Mô tả                               |
| ------------ | ---- | ----------------- | ------------------------------------- |
| `[client]` | 5173 | Vite (React)      | Giao diện người dùng              |
| `[server]` | 5000 | Node.js (Express) | API chính, MQTT, Socket.IO           |
| `[api]`    | 8000 | FastAPI (Python)  | AI Pest Detection + Humidity Forecast |

**Đối với AI API** (`scripts/start-api.js`), script Node.js sẽ tự động:

1. **Tìm Python phù hợp**: Ưu tiên `py -3.12` → `py -3.11` → `py -3.10` → `python` → `python3`
2. **Tạo virtual environment** (`.venv`) nếu chưa có
3. **Cài đặt dependencies** từ `server/AI_feature/requirements.txt` (có smart caching — chỉ cài lại khi file thay đổi)
4. **Khởi động uvicorn** tại `server/AI_feature/main.py` với hot-reload

> Lần đầu chạy sẽ mất vài phút để tạo `.venv` và cài TensorFlow (~350MB). Các lần sau sẽ khởi động nhanh.

### 7. Chạy toàn bộ bằng Docker

Docker Compose sẽ chạy đủ 4 service:

| Service    | Port host | Mô tả                                                            |
| ---------- | --------- | ------------------------------------------------------------------ |
| `client` | `5173`  | React build được serve bằng Nginx                              |
| `server` | `5000`  | Express API, Socket.IO, MQTT, scheduler                            |
| `ai-api` | `8000`  | FastAPI AI hợp nhất: pest detection + humidity forecast          |
| `mysql`  | `3307`  | MySQL 8, tự import `server/database/schema.sql` khi volume mới |

Chạy lần đầu:

```bash
docker compose up --build
```

Hoặc dùng script npm:

```bash
pnpm docker:up
```

Sau khi container chạy xong:

- Frontend: http://localhost:5173
- Express API: http://localhost:5000/api/health
- FastAPI docs: http://localhost:8000/docs
- MySQL host port: `localhost:3307`

Tài khoản mặc định sau khi schema được import:

```text
admin / admin123
```

Các biến môi trường Docker có thể override từ shell hoặc file `.env` ở root:

```env
MYSQL_ROOT_PASSWORD=root
DB_NAME=yolofarm
AI_SERVICE_TOKEN=yolofarm_dev_ai_token
FORECAST_REQUEST_TIMEOUT_MS=30000
MC_DROPOUT_SAMPLES=10
CLIENT_PORT=5173
SERVER_PORT=5000
AI_API_PORT=8000
MYSQL_PORT=3307
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Lưu ý:

- Nếu đổi `schema.sql` sau khi MySQL volume đã tồn tại, Docker sẽ không tự import lại. Muốn reset database dev, chạy:

```bash
docker compose down -v
docker compose up --build
```

- Nếu muốn kết nối Adafruit IO trong Docker, cấu hình thêm `AIO_USERNAME`, `AIO_KEY` và các feed tương ứng.
- Nếu dùng database cloud thay vì MySQL container, đặt `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; chỉ bật `DB_SSL=true` khi cloud DB yêu cầu SSL.

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
│   ├── api/                   # 🐍 Python FastAPI — AI Pest Detection
│   │   ├── main.py            # FastAPI endpoint POST /detect-disease
│   │   ├── requirements.txt   # Python dependencies (TensorFlow, Keras, ...)
│   │   └── *.keras            # Trained model weights (EfficientNet)
│   ├── database/              # SQL schema, migration scripts
│   └── src/
│       ├── config/            # DB, MQTT, Auth, Cloudinary config
│       ├── controllers/       # Route handlers (notification, user, profile, ai, ...)
│       ├── middleware/        # Auth, role middleware
│       ├── models/            # Database models
│       ├── routes/            # Express routes
│       ├── services/          # Business logic (MQTT, cron, ...)
│       └── utils/             # Tiện ích
├── scripts/                   # Helper scripts
│   └── start-api.js           # Auto-setup .venv + start FastAPI
└── .venv/                     # Python virtual environment (auto-generated)
```

## Tech Stack

| Layer    | Công nghệ                                                                               |
| -------- | ----------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Chart.js, React Router, Socket.IO Client                      |
| Backend  | Node.js, Express, Socket.IO, MQTT, node-cron, Winston                                     |
| Database | MySQL 8 (mysql2)                                                                          |
| Auth     | JWT, bcryptjs, Google OAuth 2.0                                                           |
| IoT      | Adafruit IO (MQTT protocol)                                                               |
| AI       | Python 3.12, FastAPI, TensorFlow/Keras, PyTorch/GRU — Pest Detection + Humidity Forecast |
| Storage  | Cloudinary (avatar upload, image hosting)                                                 |
| i18n     | Google Translate API (`@iamtraction/google-translate`) — dịch Privacy Policy          |

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

### AI Pest Detection

| Method | Endpoint                   | Mô tả                                                        |
| ------ | -------------------------- | -------------------------------------------------------------- |
| POST   | `/api/ai/detect-disease` | Upload ảnh lá cây → nhận diện bệnh (proxy tới FastAPI) |

**Luồng xử lý**:

```
Client (upload ảnh)
  → POST /api/ai/detect-disease (Node.js, có JWT auth)
    → POST /detect-disease (FastAPI, port 8000)
      → TensorFlow inference (EfficientNet model)
    ← { disease_name, treatment, confidence }
  ← Response to client
```

**Response mẫu**:

```json
{
  "success": true,
  "data": {
    "disease_id": 1,
    "disease_name": "Bệnh đốm sớm (Early blight)",
    "treatment": "Cắt bỏ các lá già bị bệnh nặng. Phun thuốc trừ nấm chứa hoạt chất Chlorothalonil hoặc Mancozeb.",
    "confidence": 94.72
  }
}
```

**Các loại bệnh được nhận diện** (6 lớp):

| ID | Tên bệnh                               | Mô tả                                |
| -- | ---------------------------------------- | -------------------------------------- |
| 0  | Bệnh đốm vi khuẩn (Bacterial spot)   | Xuất hiện các đốm nâu trên lá  |
| 1  | Bệnh đốm sớm (Early blight)          | Đốm tròn đồng tâm trên lá già |
| 2  | Bệnh mốc sương (Late blight)         | Bệnh nguy hiểm, gây thối nhanh     |
| 3  | Bệnh mốc lá (Leaf Mold)               | Lớp mốc trên mặt dưới lá        |
| 4  | Bệnh xoăn lá (Yellow Leaf Curl Virus) | Do bọ phấn trắng truyền bệnh      |
| 5  | Cà chua khỏe mạnh                     | Cây phát triển bình thường       |
