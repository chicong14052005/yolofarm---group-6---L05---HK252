-- Tài khoản admin mặc định (password: admin123)

CREATE DATABASE IF NOT EXISTS yolofarm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE yolofarm;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS terms;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS notifications;
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
    device_type ENUM(
        'pump1',
        'pump2',
        'led_rgb'
    ) NOT NULL,
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

-- Bảng tùy chọn người dùng (FK → users)
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    theme VARCHAR(10) DEFAULT 'light',
    locale VARCHAR(5) DEFAULT 'vi',
    primary_color VARCHAR(20) DEFAULT '#2BAE66',
    border_radius INT DEFAULT 8,
    layout_mode VARCHAR(10) DEFAULT 'desktop',
    font_family VARCHAR(50) DEFAULT '''Inter''',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Bảng điều khoản sử dụng
CREATE TABLE IF NOT EXISTS terms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    version INT DEFAULT 1,
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
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

-- Điều khoản sử dụng mặc định
INSERT INTO
    terms (
        title,
        content,
        version,
        created_by,
        is_active
    )
VALUES (
        'Điều khoản sử dụng YoloFarm',
        'Chào mừng bạn đến với YoloFarm. Bằng việc sử dụng dịch vụ của chúng tôi, bạn đồng ý tuân thủ các điều khoản sau:\n\n1. **Quyền sử dụng**: Bạn được cấp quyền sử dụng hệ thống để giám sát và điều khiển nông trại.\n2. **Bảo mật**: Bạn có trách nhiệm bảo vệ thông tin đăng nhập.\n3. **Dữ liệu**: Dữ liệu cảm biến được lưu trữ và sử dụng cho mục đích phân tích.\n4. **Thiết bị**: Việc điều khiển thiết bị từ xa phải được thực hiện có trách nhiệm.',
        1,
        1,
        TRUE
    );