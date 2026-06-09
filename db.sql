-- ============================================================
-- 自习室座位预约系统 — 数据库设计与初始化
-- Database: seat_reservation
-- ============================================================

CREATE DATABASE IF NOT EXISTS seat_reservation
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE seat_reservation;

-- ============================================================
-- 1. 用户表
-- ============================================================
DROP TABLE IF EXISTS violation;
DROP TABLE IF EXISTS reservation;
DROP TABLE IF EXISTS seat;
DROP TABLE IF EXISTS room;
DROP TABLE IF EXISTS building;
DROP TABLE IF EXISTS time_slot;
DROP TABLE IF EXISTS user;

CREATE TABLE user (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    real_name   VARCHAR(50)  NOT NULL,
    student_id  VARCHAR(20)  UNIQUE,
    credit      INT          DEFAULT 100,
    role        ENUM('student','admin') DEFAULT 'student',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 2. 楼栋表
-- ============================================================
CREATE TABLE building (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    location VARCHAR(200)
) ENGINE=InnoDB;

-- ============================================================
-- 3. 自习室表
-- ============================================================
CREATE TABLE room (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    floor       INT,
    capacity    INT NOT NULL,
    description TEXT,
    FOREIGN KEY (building_id) REFERENCES building(id)
) ENGINE=InnoDB;

-- ============================================================
-- 4. 座位表
-- ============================================================
CREATE TABLE seat (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    room_id     INT NOT NULL,
    seat_label  VARCHAR(20) NOT NULL,
    has_power   BOOLEAN DEFAULT FALSE,
    near_window BOOLEAN DEFAULT FALSE,
    status      ENUM('available','maintenance') DEFAULT 'available',
    FOREIGN KEY (room_id) REFERENCES room(id),
    UNIQUE KEY uk_room_seat (room_id, seat_label)
) ENGINE=InnoDB;

-- ============================================================
-- 5. 时间段表
-- ============================================================
CREATE TABLE time_slot (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    slot_name  VARCHAR(30) NOT NULL,
    start_time TIME NOT NULL,
    end_time   TIME NOT NULL
) ENGINE=InnoDB;

-- ============================================================
-- 6. 预约表（核心业务表）
-- ============================================================
CREATE TABLE reservation (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    seat_id       INT NOT NULL,
    reserve_date  DATE NOT NULL,
    time_slot_id  INT NOT NULL,
    status        ENUM('reserved','checked_in','completed','cancelled','absent')
                  DEFAULT 'reserved',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    checked_in_at DATETIME,
    FOREIGN KEY (user_id)      REFERENCES user(id),
    FOREIGN KEY (seat_id)      REFERENCES seat(id),
    FOREIGN KEY (time_slot_id) REFERENCES time_slot(id),
    INDEX idx_seat_date_slot (seat_id, reserve_date, time_slot_id),
    INDEX idx_user_date (user_id, reserve_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- 7. 违约记录表
-- ============================================================
CREATE TABLE violation (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    reservation_id  INT,
    reason          VARCHAR(200),
    points_deducted INT DEFAULT 10,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)        REFERENCES user(id),
    FOREIGN KEY (reservation_id) REFERENCES reservation(id)
) ENGINE=InnoDB;

-- ============================================================
-- 视图 1: 座位可用性视图
-- 查看每个座位在每个日期+时段是否可用
-- ============================================================
CREATE OR REPLACE VIEW v_seat_availability AS
SELECT
    s.id          AS seat_id,
    s.room_id,
    s.seat_label,
    s.has_power,
    s.near_window,
    s.status      AS seat_status,
    ts.id         AS slot_id,
    ts.slot_name,
    ts.start_time,
    ts.end_time,
    CASE WHEN r.id IS NOT NULL THEN 'occupied' ELSE 'free' END AS availability
FROM seat s
CROSS JOIN time_slot ts
LEFT JOIN reservation r
    ON r.seat_id = s.id
    AND r.time_slot_id = ts.id
    AND r.reserve_date = CURDATE()
    AND r.status IN ('reserved', 'checked_in')
WHERE s.status = 'available';

-- ============================================================
-- 视图 2: 各时段利用率统计（近30天）
-- ============================================================
CREATE OR REPLACE VIEW v_slot_usage_stats AS
SELECT
    ts.id            AS slot_id,
    ts.slot_name,
    COUNT(r.id)      AS total_reservations,
    SUM(CASE WHEN r.status = 'checked_in' OR r.status = 'completed' THEN 1 ELSE 0 END) AS actual_usage,
    ROUND(
        SUM(CASE WHEN r.status = 'checked_in' OR r.status = 'completed' THEN 1 ELSE 0 END)
        / NULLIF(COUNT(r.id), 0) * 100, 1
    ) AS usage_rate
FROM time_slot ts
LEFT JOIN reservation r
    ON r.time_slot_id = ts.id
    AND r.reserve_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    AND r.status IN ('reserved', 'checked_in', 'completed')
GROUP BY ts.id, ts.slot_name
ORDER BY usage_rate DESC;

-- ============================================================
-- 视图 3: 座位热度排行（近30天被预约次数）
-- ============================================================
CREATE OR REPLACE VIEW v_seat_popularity AS
SELECT
    s.id          AS seat_id,
    s.seat_label,
    rm.name       AS room_name,
    b.name        AS building_name,
    COUNT(r.id)   AS reserve_count,
    SUM(CASE WHEN r.status = 'absent' THEN 1 ELSE 0 END) AS absent_count
FROM seat s
JOIN room rm    ON rm.id = s.room_id
JOIN building b ON b.id = rm.building_id
LEFT JOIN reservation r
    ON r.seat_id = s.id
    AND r.reserve_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY s.id, s.seat_label, rm.name, b.name
ORDER BY reserve_count DESC;

-- ============================================================
-- 视图 4: 用户信用排行
-- ============================================================
CREATE OR REPLACE VIEW v_user_credit_ranking AS
SELECT
    u.id,
    u.real_name,
    u.student_id,
    u.credit,
    COUNT(DISTINCT r.id)        AS total_reservations,
    SUM(CASE WHEN r.status = 'absent' THEN 1 ELSE 0 END) AS absent_count
FROM user u
LEFT JOIN reservation r ON r.user_id = u.id
WHERE u.role = 'student'
GROUP BY u.id, u.real_name, u.student_id, u.credit
ORDER BY u.credit DESC, absent_count ASC;

-- ============================================================
-- 存储过程 1: 预约座位（含并发控制）
-- ============================================================
DELIMITER //

CREATE PROCEDURE sp_create_reservation(
    IN  p_user_id      INT,
    IN  p_seat_id      INT,
    IN  p_reserve_date DATE,
    IN  p_time_slot_id INT,
    OUT p_result       INT,       -- 0=成功, 1=已被占用, 2=信用不足, 3=座位维护中
    OUT p_message      VARCHAR(100)
)
BEGIN
    DECLARE v_credit     INT;
    DECLARE v_seat_status VARCHAR(20);
    DECLARE v_existing   INT DEFAULT 0;

    -- 开启事务
    START TRANSACTION;

    -- 检查信用分
    SELECT credit INTO v_credit FROM user WHERE id = p_user_id;
    IF v_credit < 60 THEN
        SET p_result = 2;
        SET p_message = '信用分不足，无法预约';
        ROLLBACK;
    ELSE
        -- 检查座位是否维护中
        SELECT status INTO v_seat_status FROM seat WHERE id = p_seat_id;
        IF v_seat_status = 'maintenance' THEN
            SET p_result = 3;
            SET p_message = '该座位正在维护中';
            ROLLBACK;
        ELSE
            -- 检查是否已有有效预约（行级锁防止并发）
            SELECT COUNT(*) INTO v_existing
            FROM reservation
            WHERE seat_id = p_seat_id
              AND reserve_date = p_reserve_date
              AND time_slot_id = p_time_slot_id
              AND status IN ('reserved', 'checked_in')
            FOR UPDATE;

            IF v_existing > 0 THEN
                SET p_result = 1;
                SET p_message = '该座位已被他人预约';
                ROLLBACK;
            ELSE
                -- 插入预约记录
                INSERT INTO reservation (user_id, seat_id, reserve_date, time_slot_id, status)
                VALUES (p_user_id, p_seat_id, p_reserve_date, p_time_slot_id, 'reserved');

                SET p_result = 0;
                SET p_message = '预约成功';
                COMMIT;
            END IF;
        END IF;
    END IF;
END //

-- ============================================================
-- 存储过程 2: 签到
-- ============================================================
CREATE PROCEDURE sp_check_in(
    IN  p_reservation_id INT,
    IN  p_user_id        INT,
    OUT p_result         INT,       -- 0=成功, 1=非本人预约, 2=状态不对, 3=已超时
    OUT p_message        VARCHAR(100)
)
BEGIN
    DECLARE v_status      VARCHAR(20);
    DECLARE v_owner_id    INT;
    DECLARE v_created_at  DATETIME;

    SELECT status, user_id, created_at
    INTO v_status, v_owner_id, v_created_at
    FROM reservation
    WHERE id = p_reservation_id;

    IF v_owner_id != p_user_id THEN
        SET p_result = 1;
        SET p_message = '非本人预约记录';
    ELSEIF v_status != 'reserved' THEN
        SET p_result = 2;
        SET p_message = CONCAT('当前状态为 ', v_status, '，无法签到');
    ELSEIF TIMESTAMPDIFF(MINUTE, v_created_at, NOW()) > 15 THEN
        -- 超时，自动记为缺席
        START TRANSACTION;
        UPDATE reservation SET status = 'absent' WHERE id = p_reservation_id;
        INSERT INTO violation (user_id, reservation_id, reason, points_deducted)
        VALUES (p_user_id, p_reservation_id, '超时未签到', 10);
        UPDATE user SET credit = GREATEST(credit - 10, 0) WHERE id = p_user_id;
        COMMIT;
        SET p_result = 3;
        SET p_message = '签到超时（15分钟），已自动标记为缺席';
    ELSE
        UPDATE reservation
        SET status = 'checked_in', checked_in_at = NOW()
        WHERE id = p_reservation_id;
        SET p_result = 0;
        SET p_message = '签到成功';
    END IF;
END //

-- ============================================================
-- 存储过程 3: 取消预约
-- ============================================================
CREATE PROCEDURE sp_cancel_reservation(
    IN  p_reservation_id INT,
    IN  p_user_id        INT,
    OUT p_result         INT,
    OUT p_message        VARCHAR(100)
)
BEGIN
    DECLARE v_status   VARCHAR(20);
    DECLARE v_owner_id INT;

    SELECT status, user_id INTO v_status, v_owner_id
    FROM reservation WHERE id = p_reservation_id;

    IF v_owner_id != p_user_id THEN
        SET p_result = 1;
        SET p_message = '非本人预约记录';
    ELSEIF v_status != 'reserved' THEN
        SET p_result = 2;
        SET p_message = CONCAT('当前状态为 ', v_status, '，无法取消');
    ELSE
        UPDATE reservation SET status = 'cancelled' WHERE id = p_reservation_id;
        SET p_result = 0;
        SET p_message = '取消成功';
    END IF;
END //

-- ============================================================
-- 触发器: 时间段到达后自动将未签到的"reserved"记录标记为缺席
-- 该触发器由事件调度器触发，而非直接由表操作触发
-- ============================================================

-- ============================================================
-- 事件: 每5分钟扫描一次，将超过15分钟未签到的预约标记为缺席
-- ============================================================
CREATE EVENT IF NOT EXISTS evt_auto_mark_absent
ON SCHEDULE EVERY 5 MINUTE
DO
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_reservation_id INT;
    DECLARE v_user_id INT;
    DECLARE cur CURSOR FOR
        SELECT id, user_id FROM reservation
        WHERE status = 'reserved'
          AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) > 15;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO v_reservation_id, v_user_id;
        IF done THEN LEAVE read_loop; END IF;

        UPDATE reservation SET status = 'absent' WHERE id = v_reservation_id;

        INSERT INTO violation (user_id, reservation_id, reason, points_deducted)
        VALUES (v_user_id, v_reservation_id, '超时未签到（系统自动）', 10);

        UPDATE user SET credit = GREATEST(credit - 10, 0) WHERE id = v_user_id;
    END LOOP;
    CLOSE cur;
END //

-- ============================================================
-- 事件: 每天凌晨将当天已完成(check_in but not completed)的预约标记为completed
-- ============================================================
CREATE EVENT IF NOT EXISTS evt_complete_reservations
ON SCHEDULE EVERY 1 DAY
DO
    UPDATE reservation
    SET status = 'completed'
    WHERE status = 'checked_in'
      AND reserve_date < CURDATE();
//

DELIMITER ;

-- 开启事件调度器（需要SUPER权限，如无权限可手动执行）
SET GLOBAL event_scheduler = ON;

-- ============================================================
-- 初始化数据
-- ============================================================

-- 时间段
INSERT INTO time_slot (slot_name, start_time, end_time) VALUES
('08:00-10:00', '08:00:00', '10:00:00'),
('10:00-12:00', '10:00:00', '12:00:00'),
('12:00-14:00', '12:00:00', '14:00:00'),
('14:00-16:00', '14:00:00', '16:00:00'),
('16:00-18:00', '16:00:00', '18:00:00'),
('18:00-20:00', '18:00:00', '20:00:00'),
('20:00-22:00', '20:00:00', '22:00:00');

-- 楼栋
INSERT INTO building (name, location) VALUES
('图书馆主馆', '校园中心广场东侧'),
('教学楼A座', '校园北区'),
('综合学习中心', '校园南区');

-- 自习室
INSERT INTO room (building_id, name, floor, capacity, description) VALUES
(1, '201 电子阅览室', 2, 40, '配备电源插座，适合使用笔记本电脑'),
(1, '301 自习室', 3, 30, '安静学习区，靠窗座位采光好'),
(1, '302 自习室', 3, 25, '小组学习室，可低声讨论'),
(2, '101 自习室', 1, 35, '教学楼一楼，出入方便'),
(3, '501 高级研修室', 5, 20, '高端自习室，全部座位配备电源');

-- 座位（每个自习室按容量生成）
-- 使用存储过程批量生成
DELIMITER //

CREATE PROCEDURE sp_generate_seats()
BEGIN
    DECLARE v_room_id   INT;
    DECLARE v_capacity  INT;
    DECLARE i           INT;
    DECLARE v_row       CHAR(1);
    DECLARE v_num       INT;
    DECLARE done        INT DEFAULT 0;

    DECLARE cur CURSOR FOR SELECT id, capacity FROM room;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    room_loop: LOOP
        FETCH cur INTO v_room_id, v_capacity;
        IF done THEN LEAVE room_loop; END IF;

        SET i = 1;
        WHILE i <= v_capacity DO
            SET v_row = CHAR(ASCII('A') + FLOOR((i-1) / 10));
            SET v_num = ((i-1) MOD 10) + 1;

            INSERT INTO seat (room_id, seat_label, has_power, near_window, status)
            VALUES (
                v_room_id,
                CONCAT(v_row, '-', LPAD(v_num, 2, '0')),
                IF(RAND() > 0.4, TRUE, FALSE),
                IF(v_num <= 3, TRUE, FALSE),
                IF(RAND() > 0.95, 'maintenance', 'available')
            );
            SET i = i + 1;
        END WHILE;
    END LOOP;
    CLOSE cur;
END //

DELIMITER ;

CALL sp_generate_seats();
DROP PROCEDURE IF EXISTS sp_generate_seats;

-- 初始化用户由应用层在首次启动时自动创建（密码需bcrypt哈希）
-- 访问 http://localhost:5000/register 注册账号
