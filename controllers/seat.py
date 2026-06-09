from flask import Blueprint, request, render_template, redirect, url_for, session, flash
from models.db import query, get_db

seat_bp = Blueprint('seat', __name__)


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            flash('请先登录', 'error')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated


@seat_bp.route('/')
@login_required
def index():
    """首页 — 座位地图"""
    from datetime import date as dt

    date = request.args.get('date', None)
    slot_id = request.args.get('slot_id', None)

    time_slots = query('SELECT * FROM time_slot ORDER BY start_time')

    if not date:
        date = dt.today().isoformat()
    if not slot_id and time_slots:
        slot_id = time_slots[0]['id']

    rooms = query('''
        SELECT r.id, r.name, r.floor, r.capacity, b.name AS building_name, b.id AS building_id
        FROM room r
        JOIN building b ON b.id = r.building_id
        ORDER BY b.id, r.floor, r.name
    ''')

    seats_data = []
    for room in rooms:
        seats = query('''
            SELECT s.*,
                CASE WHEN res.id IS NOT NULL THEN 'occupied' ELSE 'free' END AS avail
            FROM seat s
            LEFT JOIN reservation res
                ON res.seat_id = s.id
                AND res.reserve_date = %s
                AND res.time_slot_id = %s
                AND res.status IN ('reserved', 'checked_in')
            WHERE s.room_id = %s
            ORDER BY s.seat_label
        ''', (date, slot_id, room['id']))
        room['seats'] = seats
        seats_data.append(room)

    selected_slot = query('SELECT * FROM time_slot WHERE id = %s', (slot_id,), one=True)

    return render_template('index.html',
        time_slots=time_slots,
        rooms=seats_data,
        selected_date=date,
        selected_slot=selected_slot,
        slot_id=int(slot_id) if slot_id else None,
    )


@seat_bp.route('/reserve', methods=['POST'])
@login_required
def reserve():
    """预约座位 — 直接SQL + 事务 + 行锁"""
    seat_id = int(request.form.get('seat_id', 0))
    date = request.form.get('date', '')
    time_slot_id = int(request.form.get('time_slot_id', 0))
    user_id = session['user_id']

    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 1. 检查信用分
            cur.execute('SELECT credit FROM user WHERE id = %s', (user_id,))
            user_row = cur.fetchone()
            if not user_row:
                flash('用户信息异常，请重新登录', 'error')
                conn.close()
                return redirect(url_for('auth.login'))
            credit = user_row['credit']
            if credit < 60:
                flash('信用分不足，无法预约', 'error')
                conn.close()
                return redirect(url_for('seat.index', date=date, slot_id=time_slot_id))

            # 2. 检查座位状态
            cur.execute('SELECT status FROM seat WHERE id = %s', (seat_id,))
            seat = cur.fetchone()
            if not seat or seat['status'] == 'maintenance':
                flash('该座位正在维护中', 'error')
                conn.close()
                return redirect(url_for('seat.index', date=date, slot_id=time_slot_id))

            # 3. 查询是否有冲突预约（用 FOR UPDATE 行锁）
            cur.execute('''
                SELECT id FROM reservation
                WHERE seat_id = %s
                  AND reserve_date = %s
                  AND time_slot_id = %s
                  AND status IN ('reserved', 'checked_in')
                FOR UPDATE
            ''', (seat_id, date, time_slot_id))

            if cur.fetchone():
                conn.rollback()
                flash('该座位已被他人预约', 'error')
                conn.close()
                return redirect(url_for('seat.index', date=date, slot_id=time_slot_id))

            # 4. 插入预约
            cur.execute('''
                INSERT INTO reservation (user_id, seat_id, reserve_date, time_slot_id, status)
                VALUES (%s, %s, %s, %s, 'reserved')
            ''', (user_id, seat_id, date, time_slot_id))
            conn.commit()

            flash('预约成功！请在15分钟内签到', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'预约失败: {e}', 'error')
    finally:
        conn.close()

    return redirect(url_for('seat.index', date=date, slot_id=time_slot_id))


@seat_bp.route('/checkin/<int:reservation_id>', methods=['POST'])
@login_required
def checkin(reservation_id):
    """签到"""
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 查预约信息
            cur.execute('''
                SELECT user_id, status, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS elapsed
                FROM reservation WHERE id = %s
            ''', (reservation_id,))
            r = cur.fetchone()

            if not r:
                flash('预约记录不存在', 'error')
            elif r['user_id'] != user_id:
                flash('非本人预约记录', 'error')
            elif r['status'] != 'reserved':
                flash(f'当前状态无法签到', 'error')
            elif r['elapsed'] > 15:
                # 超时：标记缺席 + 扣分
                cur.execute("UPDATE reservation SET status = 'absent' WHERE id = %s", (reservation_id,))
                cur.execute('''
                    INSERT INTO violation (user_id, reservation_id, reason, points_deducted)
                    VALUES (%s, %s, '超时未签到', 10)
                ''', (user_id, reservation_id))
                cur.execute('UPDATE user SET credit = GREATEST(credit - 10, 0) WHERE id = %s', (user_id,))
                conn.commit()
                flash('签到超时（15分钟），已自动标记为缺席并扣除10分', 'error')
            else:
                cur.execute("UPDATE reservation SET status = 'checked_in', checked_in_at = NOW() WHERE id = %s",
                            (reservation_id,))
                conn.commit()
                flash('签到成功', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'签到失败: {e}', 'error')
    finally:
        conn.close()

    return redirect(url_for('seat.my_reservations'))


@seat_bp.route('/cancel/<int:reservation_id>', methods=['POST'])
@login_required
def cancel(reservation_id):
    """取消预约"""
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT user_id, status FROM reservation WHERE id = %s', (reservation_id,))
            r = cur.fetchone()

            if not r:
                flash('预约记录不存在', 'error')
            elif r['user_id'] != user_id:
                flash('非本人预约记录', 'error')
            elif r['status'] != 'reserved':
                flash('当前状态无法取消', 'error')
            else:
                cur.execute("UPDATE reservation SET status = 'cancelled' WHERE id = %s", (reservation_id,))
                conn.commit()
                flash('取消成功', 'success')
    except Exception as e:
        conn.rollback()
        flash(f'取消失败: {e}', 'error')
    finally:
        conn.close()

    return redirect(url_for('seat.my_reservations'))


@seat_bp.route('/my-reservations')
@login_required
def my_reservations():
    """我的预约"""
    reservations = query('''
        SELECT
            r.id, r.reserve_date, r.status, r.created_at, r.checked_in_at,
            s.seat_label,
            rm.name AS room_name,
            b.name AS building_name,
            ts.slot_name
        FROM reservation r
        JOIN seat s      ON s.id = r.seat_id
        JOIN room rm     ON rm.id = s.room_id
        JOIN building b  ON b.id = rm.building_id
        JOIN time_slot ts ON ts.id = r.time_slot_id
        WHERE r.user_id = %s
        ORDER BY r.reserve_date DESC, ts.start_time DESC
    ''', (session['user_id'],))

    status_map = {
        'reserved': '已预约',
        'checked_in': '已签到',
        'completed': '已完成',
        'cancelled': '已取消',
        'absent': '缺席',
    }
    for r in reservations:
        r['status_text'] = status_map.get(r['status'], r['status'])

    return render_template('my_reservations.html', reservations=reservations)


@seat_bp.route('/stats')
@login_required
def stats():
    """统计面板"""
    slot_stats = query('SELECT * FROM v_slot_usage_stats')
    seat_popularity = query('SELECT * FROM v_seat_popularity LIMIT 20')
    credit_ranking = query('SELECT * FROM v_user_credit_ranking LIMIT 20')

    total_users = query('SELECT COUNT(*) AS cnt FROM user WHERE role = "student"', one=True)['cnt']
    total_seats = query('SELECT COUNT(*) AS cnt FROM seat WHERE status = "available"', one=True)['cnt']
    today_reservations = query(
        'SELECT COUNT(*) AS cnt FROM reservation WHERE reserve_date = CURDATE()', one=True
    )['cnt']

    return render_template('stats.html',
        slot_stats=slot_stats,
        seat_popularity=seat_popularity,
        credit_ranking=credit_ranking,
        total_users=total_users,
        total_seats=total_seats,
        today_reservations=today_reservations,
    )
