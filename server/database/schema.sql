-- Tài khoản admin mặc định (password: admin123)

CREATE DATABASE IF NOT EXISTS yolofarm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE yolofarm;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS privacy_policy;

DROP TABLE IF EXISTS user_preferences;

DROP TABLE IF EXISTS settings;

DROP TABLE IF EXISTS notifications;

DROP TABLE IF EXISTS forecast_history;

drop table if exists forecast_cache;

DROP TABLE IF EXISTS schedules;

DROP TABLE IF EXISTS sensor_data;

DROP TABLE IF EXISTS devices;

DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- Bảng người dùng
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('user', 'admin') DEFAULT 'user',
    status ENUM(
        'active',
        'inactive',
        'banned'
    ) DEFAULT 'active',
    avatar_url VARCHAR(255),
    google_id VARCHAR(255) UNIQUE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng thiết bị
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_name VARCHAR(50) NOT NULL,
    device_type ENUM('pump1', 'pump2', 'led_rgb') NOT NULL,
    feed_key VARCHAR(100),
    status ENUM('on', 'off') DEFAULT 'off',
    manual_override BOOLEAN DEFAULT FALSE,
    last_toggled_at TIMESTAMP DEFAULT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng dữ liệu cảm biến (FK → devices)
CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT DEFAULT NULL,
    sensor_type ENUM(
        'temperature',
        'humidity',
        'soil_moisture',
        'light'
    ) NOT NULL,
    value FLOAT NOT NULL,
    feed_key VARCHAR(100),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type_time (sensor_type, recorded_at),
    FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE SET NULL
);

-- Bảng lịch tưới (FK → users, devices)
CREATE TABLE IF NOT EXISTS schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    device_id INT DEFAULT NULL,
    schedule_name VARCHAR(100),
    start_time TIME NOT NULL,
    duration_minutes INT NOT NULL,
    repeat_days VARCHAR(50) DEFAULT 'daily',
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE SET NULL
);

-- Bảng thông báo (FK → users)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    type ENUM(
        'warning',
        'info',
        'error',
        'ai_alert',
        'system'
    ) NOT NULL,
    title VARCHAR(200),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_saved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Bảng cài đặt hệ thống
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value VARCHAR(255),
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng cache dự báo AI
CREATE TABLE IF NOT EXISTS forecast_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_type VARCHAR(50) NOT NULL UNIQUE,
    predictions JSON,
    historical_predictions JSON,
    data_summary JSON,
    alert_status JSON,
    model_version VARCHAR(50),
    horizon_hours INT DEFAULT 24,
    interval_minutes INT DEFAULT 15,
    generated_at TIMESTAMP NULL,
    fallback BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bảng tùy chọn người dùng (FK → users)
-- Bang lich su tung diem du bao AI
CREATE TABLE IF NOT EXISTS forecast_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sensor_type VARCHAR(50) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    point_type ENUM('historical', 'future') NOT NULL,
    target_timestamp TIMESTAMP NOT NULL,
    actual_value FLOAT DEFAULT NULL,
    predicted_value FLOAT DEFAULT NULL,
    lower_value FLOAT DEFAULT NULL,
    upper_value FLOAT DEFAULT NULL,
    confidence FLOAT DEFAULT NULL,
    model_version VARCHAR(50),
    horizon_hours INT DEFAULT 24,
    interval_minutes INT DEFAULT 15,
    generated_at TIMESTAMP NULL,
    fallback BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_forecast_history_lookup (sensor_type, point_type, target_timestamp),
    INDEX idx_forecast_history_run (sensor_type, run_id),
    INDEX idx_forecast_history_generated (generated_at)
);

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    theme VARCHAR(10) DEFAULT 'light',
    locale VARCHAR(5) DEFAULT 'vi',
    primary_color VARCHAR(20) DEFAULT '#2BAE66',
    border_radius INT DEFAULT 8,
    layout_mode VARCHAR(10) DEFAULT 'desktop',
    font_family VARCHAR(50) DEFAULT 'Inter',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Tài khoản admin mặc định (password: admin123)
INSERT INTO
    users (
        username,
        email,
        password,
        full_name,
        role
    )
VALUES (
        'admin',
        'admin@yolofarm.com',
        '$2a$10$Qzje/Yu5f4MK1F3NRDmeAeJFeFxzz1uPKCfE/0mDoH/Jm1HtOG7ue',
        'System Admin',
        'admin'
    );

-- Thiết bị mặc định
INSERT INTO
    devices (
        device_name,
        device_type,
        feed_key,
        status
    )
VALUES (
        'Máy bơm 1',
        'pump1',
        'pump1',
        'off'
    ),
    (
        'Máy bơm 2',
        'pump2',
        'pump2',
        'off'
    ),
    (
        'Đèn LED RGB',
        'led_rgb',
        'led-rgb',
        'off'
    );

-- Cài đặt hệ thống mặc định
INSERT INTO
    settings (
        setting_key,
        setting_value,
        description
    )
VALUES (
        'soil_moisture_threshold',
        '40',
        'Ngưỡng độ ẩm đất để kích hoạt tưới tự động (%)'
    ),
    (
        'temperature_warning',
        '35',
        'Ngưỡng nhiệt độ cảnh báo (°C)'
    ),
    (
        'humidity_warning_low',
        '30',
        'Ngưỡng độ ẩm không khí thấp cảnh báo (%)'
    ),
    (
        'sensor_read_interval',
        '30',
        'Tần suất đọc cảm biến (giây)'
    ),
    (
        'auto_irrigation_enabled',
        'true',
        'Bật/tắt tưới tự động theo ngưỡng'
    ),
    (
        'forecast_humidity_warning_threshold',
        '40',
        'Ngưỡng cảnh báo dự báo độ ẩm không khí thấp (%)'
    ),
    (
        'forecast_humidity_min_confidence',
        '0.7',
        'Độ tin cậy tối thiểu để phát cảnh báo dự báo (0-1)'
    );

-- User preferences mặc định cho admin
INSERT INTO
    user_preferences (
        user_id,
        theme,
        locale,
        primary_color,
        border_radius,
        layout_mode
    )
VALUES (
        1,
        'dark',
        'vi',
        '#2BAE66',
        8,
        'desktop'
    );

-- Lịch tưới mẫu
INSERT INTO
    schedules (
        user_id,
        device_id,
        schedule_name,
        start_time,
        duration_minutes,
        repeat_days,
        is_active
    )
VALUES (
        1,
        1,
        'Morning Soak',
        '04:30',
        135,
        'Mon,Tue,Wed,Thu,Fri',
        TRUE
    ),
    (
        1,
        1,
        'Flash Mist',
        '08:00',
        75,
        'Tue,Thu',
        TRUE
    ),
    (
        1,
        2,
        'Dew Mimic',
        '02:15',
        90,
        'Mon,Wed,Fri',
        TRUE
    );

-- Thông báo mẫu
INSERT INTO
    notifications (user_id, type, title, message)
VALUES (
        1,
        'warning',
        'Độ ẩm đất thấp tại Zone A',
        'Mức độ ẩm đất hiện tại giảm xuống dưới 15% tại khu vực Đông Bắc. Hệ thống đã tự động kích hoạt tưới.'
    ),
    (
        1,
        'info',
        'Tối ưu hóa thu hoạch hoàn tất',
        'Phân tích AI cho thấy khung thời gian thu hoạch lý tưởng cho Zone C bắt đầu trong 48 giờ.'
    ),
    (
        1,
        'info',
        'Dự báo mưa lớn thứ Sáu',
        'Dự kiến 25mm mưa. Lịch tưới đã được tạm dừng tự động.'
    ),
    (
        1,
        'system',
        'Báo cáo bền vững hàng tuần',
        'Nông trại của bạn đã giảm 12% lượng nước sử dụng trong tuần này so với tiêu chuẩn địa phương.'
    );

-- Bảng chính sách bảo mật
CREATE TABLE IF NOT EXISTS privacy_policy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    content_vi TEXT,
    content_en TEXT,
    version INT DEFAULT 1,
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- Chính sách bảo mật mặc định
INSERT INTO
    privacy_policy (
        title,
        content,
        version,
        created_by,
        is_active
    )
VALUES (
        'Điều khoản sử dụng YoloFarm',
        '# Chính sách bảo mật Smart Farm

**Smart Farm** cam kết bảo vệ quyền riêng tư và dữ liệu cá nhân của bạn một cách tối đa. Chính sách bảo mật này mô tả chi tiết cách thức chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin cá nhân của bạn khi bạn sử dụng hệ thống nông nghiệp thông minh của chúng tôi.

## 1. Thu thập dữ liệu
Hệ thống của chúng tôi thu thập các loại thông tin sau:
* **Thông tin tài khoản:** Tên đăng nhập, địa chỉ email, ảnh đại diện và mật khẩu đã được mã hóa.
* **Dữ liệu IoT & Cảm biến:** Nhiệt độ, độ ẩm, ánh sáng và các chỉ số môi trường khác được ghi nhận từ hệ thống phần cứng.
* **Lịch sử hoạt động:** Nhật ký điều khiển thiết bị, lịch tưới tự động và các thao tác trên ứng dụng.

## 2. Sử dụng dữ liệu
Dữ liệu thu thập được sử dụng cho các mục đích:
* Vận hành và duy trì tính ổn định của hệ thống Smart Farm.
* Cung cấp dữ liệu cho các mô hình phân tích AI nhằm đưa ra dự đoán và gợi ý chăm sóc cây trồng hiệu quả hơn.
* Cải thiện trải nghiệm người dùng và nâng cấp các dịch vụ trong tương lai.

## 3. Bảo mật dữ liệu
Sự an toàn của dữ liệu là ưu tiên hàng đầu của chúng tôi. Mọi dữ liệu cá nhân và thông số cảm biến đều được mã hóa trong quá trình truyền tải và lưu trữ an toàn trên cơ sở dữ liệu.

## 4. Quyền của người dùng
Bạn hoàn toàn làm chủ dữ liệu của mình. Bạn có quyền:
* Truy cập và xem xét lại các thông tin cá nhân đang được lưu trữ.
* Chỉnh sửa thông tin bất cứ lúc nào thông qua trang Cài đặt.
* Yêu cầu vô hiệu hóa tài khoản hoặc xóa bỏ hoàn toàn dữ liệu cá nhân khỏi hệ thống.

## 5. Chia sẻ dữ liệu
**Smart Farm** cam kết tuyệt đối không bán, cho thuê hoặc chia sẻ dữ liệu cá nhân của bạn với bất kỳ bên thứ ba nào, trừ khi có sự đồng ý rõ ràng từ bạn hoặc khi có yêu cầu hợp pháp từ cơ quan chức năng.',
        1,
        1,
        TRUE
    );
