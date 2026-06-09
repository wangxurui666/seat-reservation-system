import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "seat_reservation.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql, params=None, one=False):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        if one:
            return cur.fetchone()
        return cur.fetchall()
    finally:
        conn.close()


def execute(sql, params=None):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        conn.commit()
        return cur.rowcount
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize SQLite database with schema and seed data"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            real_name TEXT NOT NULL,
            student_id TEXT UNIQUE,
            credit INTEGER DEFAULT 100,
            role TEXT DEFAULT 'student' CHECK(role IN ('student','admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS building (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT
        );

        CREATE TABLE IF NOT EXISTS room (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_id INTEGER NOT NULL REFERENCES building(id),
            name TEXT NOT NULL,
            floor INTEGER,
            capacity INTEGER NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS seat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL REFERENCES room(id),
            seat_label TEXT NOT NULL,
            has_power INTEGER DEFAULT 0,
            near_window INTEGER DEFAULT 0,
            status TEXT DEFAULT 'available' CHECK(status IN ('available','maintenance')),
            UNIQUE(room_id, seat_label)
        );

        CREATE TABLE IF NOT EXISTS time_slot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slot_name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reservation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(id),
            seat_id INTEGER NOT NULL REFERENCES seat(id),
            reserve_date TEXT NOT NULL,
            time_slot_id INTEGER NOT NULL REFERENCES time_slot(id),
            status TEXT DEFAULT 'reserved' CHECK(status IN ('reserved','checked_in','completed','cancelled','absent')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            checked_in_at DATETIME
        );

        CREATE INDEX IF NOT EXISTS idx_res_seat ON reservation(seat_id, reserve_date, time_slot_id);
        CREATE INDEX IF NOT EXISTS idx_res_user ON reservation(user_id, reserve_date);
        CREATE INDEX IF NOT EXISTS idx_res_status ON reservation(status);

        CREATE TABLE IF NOT EXISTS violation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(id),
            reservation_id INTEGER REFERENCES reservation(id),
            reason TEXT,
            points_deducted INTEGER DEFAULT 10,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed time slots (only if empty)
    cur.execute("SELECT COUNT(*) FROM time_slot")
    if cur.fetchone()[0] == 0:
        slots = [
            ('08:00-10:00', '08:00:00', '10:00:00'),
            ('10:00-12:00', '10:00:00', '12:00:00'),
            ('12:00-14:00', '12:00:00', '14:00:00'),
            ('14:00-16:00', '14:00:00', '16:00:00'),
            ('16:00-18:00', '16:00:00', '18:00:00'),
            ('18:00-20:00', '18:00:00', '20:00:00'),
            ('20:00-22:00', '20:00:00', '22:00:00'),
        ]
        cur.executemany("INSERT INTO time_slot (slot_name, start_time, end_time) VALUES (?, ?, ?)", slots)

    # Seed buildings
    cur.execute("SELECT COUNT(*) FROM building")
    if cur.fetchone()[0] == 0:
        buildings = [
            ('图书馆主馆', '校园中心广场东侧'),
            ('教学楼A座', '校园北区'),
            ('综合学习中心', '校园南区'),
        ]
        cur.executemany("INSERT INTO building (name, location) VALUES (?, ?)", buildings)

    # Seed rooms
    cur.execute("SELECT COUNT(*) FROM room")
    if cur.fetchone()[0] == 0:
        rooms = [
            (1, '201 电子阅览室', 2, 40, '配备电源插座，适合使用笔记本电脑'),
            (1, '301 自习室', 3, 30, '安静学习区，靠窗座位采光好'),
            (1, '302 自习室', 3, 25, '小组学习室，可低声讨论'),
            (2, '101 自习室', 1, 35, '教学楼一楼，出入方便'),
            (3, '501 高级研修室', 5, 20, '高端自习室，全部座位配备电源'),
        ]
        cur.executemany("INSERT INTO room (building_id, name, floor, capacity, description) VALUES (?, ?, ?, ?, ?)", rooms)

    # Seed seats
    cur.execute("SELECT COUNT(*) FROM seat")
    if cur.fetchone()[0] == 0:
        for room_id, capacity in [(1, 40), (2, 30), (3, 25), (4, 35), (5, 20)]:
            for i in range(1, capacity + 1):
                row_letter = chr(ord('A') + (i - 1) // 10)
                row_num = ((i - 1) % 10) + 1
                label = f"{row_letter}-{row_num:02d}"
                has_power = 1 if (i % 3 != 0) else 0
                near_window = 1 if (row_num <= 3) else 0
                status = 'maintenance' if (i > capacity - 2) else 'available'
                cur.execute(
                    "INSERT INTO seat (room_id, seat_label, has_power, near_window, status) VALUES (?, ?, ?, ?, ?)",
                    (room_id, label, has_power, near_window, status)
                )

    # Seed admin user
    cur.execute("SELECT COUNT(*) FROM user WHERE username='admin'")
    if cur.fetchone()[0] == 0:
        import bcrypt
        hashed = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt(rounds=12))
        cur.execute(
            "INSERT INTO user (username, password, real_name, student_id, role) VALUES (?, ?, ?, ?, ?)",
            ('admin', hashed.decode(), '系统管理员', '000000', 'admin')
        )

    conn.commit()
    conn.close()
    print("Database initialized successfully.")


# ========== Business Logic (replaces MySQL stored procedures) ==========

def reserve_seat(user_id, seat_id, reserve_date, time_slot_id):
    """预约座位 (replaces sp_create_reservation)"""
    conn = get_db()
    try:
        cur = conn.cursor()

        # Check credit
        cur.execute("SELECT credit FROM user WHERE id = ?", (user_id,))
        row = cur.fetchone()
        if not row or row['credit'] < 60:
            conn.close()
            return 2, "信用分不足，无法预约"

        # Check seat status
        cur.execute("SELECT status FROM seat WHERE id = ?", (seat_id,))
        row = cur.fetchone()
        if not row or row['status'] == 'maintenance':
            conn.close()
            return 3, "该座位正在维护中"

        # Check conflict (SQLite doesn't have FOR UPDATE, but single-writer ensures serial access)
        cur.execute(
            "SELECT id FROM reservation WHERE seat_id=? AND reserve_date=? AND time_slot_id=? AND status IN ('reserved','checked_in')",
            (seat_id, reserve_date, time_slot_id)
        )
        if cur.fetchone():
            conn.close()
            return 1, "该座位已被他人预约"

        # Insert reservation
        cur.execute(
            "INSERT INTO reservation (user_id, seat_id, reserve_date, time_slot_id, status) VALUES (?, ?, ?, ?, 'reserved')",
            (user_id, seat_id, reserve_date, time_slot_id)
        )
        conn.commit()
        conn.close()
        return 0, "预约成功！请在15分钟内签到"
    except Exception as e:
        conn.rollback()
        conn.close()
        return -1, str(e)


def check_in_reservation(reservation_id, user_id):
    """签到 (replaces sp_check_in)"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id, status, (strftime('%s','now') - strftime('%s', created_at)) / 60.0 AS elapsed FROM reservation WHERE id = ?",
            (reservation_id,)
        )
        r = cur.fetchone()

        if not r:
            conn.close()
            return 4, "预约记录不存在"
        if r['user_id'] != user_id:
            conn.close()
            return 1, "非本人预约记录"
        if r['status'] != 'reserved':
            conn.close()
            return 2, "当前状态无法签到"
        if r['elapsed'] > 15:
            # Timed out: mark absent + violation + deduct credit
            cur.execute("UPDATE reservation SET status='absent' WHERE id=?", (reservation_id,))
            cur.execute(
                "INSERT INTO violation (user_id, reservation_id, reason, points_deducted) VALUES (?, ?, '超时未签到', 10)",
                (user_id, reservation_id)
            )
            cur.execute("UPDATE user SET credit = MAX(credit - 10, 0) WHERE id=?", (user_id,))
            conn.commit()
            conn.close()
            return 3, "签到超时（15分钟），已自动标记为缺席并扣10分"
        else:
            cur.execute("UPDATE reservation SET status='checked_in', checked_in_at=datetime('now','localtime') WHERE id=?", (reservation_id,))
            conn.commit()
            conn.close()
            return 0, "签到成功"
    except Exception as e:
        conn.rollback()
        conn.close()
        return -1, str(e)


def cancel_reservation(reservation_id, user_id):
    """取消预约 (replaces sp_cancel_reservation)"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT user_id, status FROM reservation WHERE id=?", (reservation_id,))
        r = cur.fetchone()
        if not r:
            conn.close()
            return 4, "预约记录不存在"
        if r['user_id'] != user_id:
            conn.close()
            return 1, "非本人预约记录"
        if r['status'] != 'reserved':
            conn.close()
            return 2, "当前状态无法取消"
        cur.execute("UPDATE reservation SET status='cancelled' WHERE id=?", (reservation_id,))
        conn.commit()
        conn.close()
        return 0, "取消成功"
    except Exception as e:
        conn.rollback()
        conn.close()
        return -1, str(e)


def process_timeout_absences():
    """Process timeout absences (replaces MySQL event evt_auto_mark_absent)"""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, user_id FROM reservation WHERE status='reserved' AND (strftime('%s','now') - strftime('%s', created_at)) > 900"
        )
        rows = cur.fetchall()
        for row in rows:
            cur.execute("UPDATE reservation SET status='absent' WHERE id=?", (row['id'],))
            cur.execute(
                "INSERT INTO violation (user_id, reservation_id, reason, points_deducted) VALUES (?, ?, '超时未签到（系统自动）', 10)",
                (row['user_id'], row['id'])
            )
            cur.execute("UPDATE user SET credit = MAX(credit - 10, 0) WHERE id=?", (row['user_id'],))
        conn.commit()
        conn.close()
        return len(rows)
    except Exception as e:
        conn.rollback()
        conn.close()
        return 0


# ========== View equivalents (replaces MySQL views) ==========

def get_slot_usage_stats():
    return query("""
        SELECT ts.id AS slot_id, ts.slot_name,
            COUNT(r.id) AS total_reservations,
            SUM(CASE WHEN r.status IN ('checked_in','completed') THEN 1 ELSE 0 END) AS actual_usage,
            ROUND(CAST(SUM(CASE WHEN r.status IN ('checked_in','completed') THEN 1 ELSE 0 END) AS FLOAT)
                  / NULLIF(COUNT(r.id), 0) * 100, 1) AS usage_rate
        FROM time_slot ts
        LEFT JOIN reservation r ON r.time_slot_id=ts.id
            AND r.reserve_date >= date('now', '-30 days')
            AND r.status IN ('reserved','checked_in','completed')
        GROUP BY ts.id, ts.slot_name
        ORDER BY usage_rate DESC
    """)


def get_seat_popularity():
    return query("""
        SELECT s.id AS seat_id, s.seat_label, rm.name AS room_name, b.name AS building_name,
            COUNT(r.id) AS reserve_count,
            SUM(CASE WHEN r.status='absent' THEN 1 ELSE 0 END) AS absent_count
        FROM seat s
        JOIN room rm ON rm.id=s.room_id
        JOIN building b ON b.id=rm.building_id
        LEFT JOIN reservation r ON r.seat_id=s.id AND r.reserve_date >= date('now','-30 days')
        GROUP BY s.id, s.seat_label, rm.name, b.name
        ORDER BY reserve_count DESC
        LIMIT 20
    """)


def get_user_credit_ranking():
    return query("""
        SELECT u.id, u.real_name, u.student_id, u.credit,
            COUNT(DISTINCT r.id) AS total_reservations,
            SUM(CASE WHEN r.status='absent' THEN 1 ELSE 0 END) AS absent_count
        FROM user u
        LEFT JOIN reservation r ON r.user_id=u.id
        WHERE u.role='student'
        GROUP BY u.id, u.real_name, u.student_id, u.credit
        ORDER BY u.credit DESC, absent_count ASC
        LIMIT 20
    """)
