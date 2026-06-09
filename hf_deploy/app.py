from flask import Flask, session, request, render_template, redirect, url_for, flash
from functools import wraps
import bcrypt
from db import query, get_db, init_db, reserve_seat, check_in_reservation, cancel_reservation
from db import process_timeout_absences, get_slot_usage_stats, get_seat_popularity, get_user_credit_ranking

app = Flask(__name__)
app.secret_key = "hf-seat-reservation-secret-key-2024"


# ========== Template Context ==========
@app.context_processor
def inject_session_user():
    if session.get('id'):
        return dict(session_user=dict(
            id=session.get('id'),
            username=session.get('username'),
            real_name=session.get('real_name'),
            role=session.get('role'),
        ))
    return dict(session_user=None)


# ========== Init ==========
@app.before_request
def verify_session():
    if session.get('id'):
        u = query("SELECT id FROM user WHERE id=?", (session['id'],), one=True)
        if not u:
            session.clear()

# ========== Auth ==========
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        user = query("SELECT * FROM user WHERE username=?", (username,), one=True)
        if user and bcrypt.checkpw(password.encode(), user['password'].encode()):
            for k in ['id', 'username', 'real_name', 'role']:
                session[k] = user[k]
            flash(f"欢迎回来，{user['real_name']}！", 'success')
            return redirect(url_for('index'))
        flash('用户名或密码错误', 'error')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        real_name = request.form.get('real_name', '').strip()
        student_id = request.form.get('student_id', '').strip()
        if not all([username, password, real_name]):
            flash('请填写所有必填字段', 'error')
            return render_template('register.html')
        exist = query("SELECT id FROM user WHERE username=? OR student_id=?", (username, student_id), one=True)
        if exist:
            flash('用户名或学号已被注册', 'error')
            return render_template('register.html')
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
        from db import execute
        execute("INSERT INTO user (username, password, real_name, student_id) VALUES (?,?,?,?)",
                (username, hashed.decode(), real_name, student_id))
        flash('注册成功，请登录', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ========== Decorators ==========
def login_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'id' not in session:
            return redirect(url_for('login'))
        return f(*a, **kw)
    return dec


def admin_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if session.get('role') != 'admin':
            flash('需要管理员权限', 'error')
            return redirect(url_for('index'))
        return f(*a, **kw)
    return dec


# ========== Seat Map (Home) ==========
@app.route('/')
@login_required
def index():
    from datetime import date as dt
    date = request.args.get('date', dt.today().isoformat())
    time_slots = query("SELECT * FROM time_slot ORDER BY start_time")
    slot_id = request.args.get('slot_id', str(time_slots[0]['id']) if time_slots else None)

    rooms = query("""
        SELECT r.*, b.name AS building_name, b.id AS building_id
        FROM room r JOIN building b ON b.id=r.building_id ORDER BY b.id, r.floor, r.name
    """)

    seats_data = []
    for room in rooms:
        seats = query("""
            SELECT s.*, CASE WHEN res.id IS NOT NULL THEN 'occupied' ELSE 'free' END AS avail
            FROM seat s
            LEFT JOIN reservation res ON res.seat_id=s.id AND res.reserve_date=?
                AND res.time_slot_id=? AND res.status IN ('reserved','checked_in')
            WHERE s.room_id=? ORDER BY s.seat_label
        """, (date, slot_id, room['id']))
        room = dict(room)
        room['seats'] = seats
        seats_data.append(room)

    selected_slot = query("SELECT * FROM time_slot WHERE id=?", (slot_id,), one=True)
    return render_template('index.html', time_slots=time_slots, rooms=seats_data,
                           selected_date=date, selected_slot=selected_slot, slot_id=int(slot_id) if slot_id else None)


# ========== Reserve ==========
@app.route('/reserve', methods=['POST'])
@login_required
def reserve():
    seat_id = int(request.form.get('seat_id', 0))
    date = request.form.get('date', '')
    slot_id = int(request.form.get('time_slot_id', 0))

    # Process timeouts before each reservation attempt
    process_timeout_absences()

    result, message = reserve_seat(session['id'], seat_id, date, slot_id)
    if result == 0:
        flash(message, 'success')
    else:
        flash(message, 'error')
    return redirect(url_for('index', date=date, slot_id=slot_id))


# ========== Check In ==========
@app.route('/checkin/<int:reservation_id>', methods=['POST'])
@login_required
def checkin(reservation_id):
    result, message = check_in_reservation(reservation_id, session['id'])
    if result == 0:
        flash(message, 'success')
    else:
        flash(message, 'error')
    return redirect(url_for('my_reservations'))


# ========== Cancel ==========
@app.route('/cancel/<int:reservation_id>', methods=['POST'])
@login_required
def cancel(reservation_id):
    result, message = cancel_reservation(reservation_id, session['id'])
    if result == 0:
        flash(message, 'success')
    else:
        flash(message, 'error')
    return redirect(url_for('my_reservations'))


# ========== My Reservations ==========
@app.route('/my-reservations')
@login_required
def my_reservations():
    reservations = query("""
        SELECT r.*, s.seat_label, rm.name AS room_name, b.name AS building_name, ts.slot_name
        FROM reservation r
        JOIN seat s ON s.id=r.seat_id
        JOIN room rm ON rm.id=s.room_id
        JOIN building b ON b.id=rm.building_id
        JOIN time_slot ts ON ts.id=r.time_slot_id
        WHERE r.user_id=? ORDER BY r.reserve_date DESC, ts.start_time DESC
    """, (session['id'],))

    status_map = {'reserved':'已预约','checked_in':'已签到','completed':'已完成','cancelled':'已取消','absent':'缺席'}
    res_list = []
    for r in reservations:
        d = dict(r)
        d['status_text'] = status_map.get(d['status'], d['status'])
        res_list.append(d)
    return render_template('my_reservations.html', reservations=res_list)


# ========== Stats ==========
@app.route('/stats')
@login_required
def stats():
    slot_stats = get_slot_usage_stats()
    seat_pop = get_seat_popularity()
    credit_rank = get_user_credit_ranking()
    total_users = query("SELECT COUNT(*) AS cnt FROM user WHERE role='student'", one=True)['cnt']
    total_seats = query("SELECT COUNT(*) AS cnt FROM seat WHERE status='available'", one=True)['cnt']
    today_res = query("SELECT COUNT(*) AS cnt FROM reservation WHERE reserve_date=date('now')", one=True)['cnt']
    return render_template('stats.html', slot_stats=slot_stats, seat_popularity=seat_pop,
                           credit_ranking=credit_rank, total_users=total_users,
                           total_seats=total_seats, today_reservations=today_res)


# ========== Admin ==========
@app.route('/admin/')
@admin_required
def admin_index():
    rooms = query("SELECT r.*, b.name AS building_name FROM room r JOIN building b ON b.id=r.building_id ORDER BY b.id, r.floor, r.name")
    violations = query("""
        SELECT v.*, u.real_name, u.student_id, s.seat_label
        FROM violation v
        JOIN user u ON u.id=v.user_id
        LEFT JOIN reservation r ON r.id=v.reservation_id
        LEFT JOIN seat s ON s.id=r.seat_id
        ORDER BY v.created_at DESC LIMIT 50
    """)
    buildings = query("SELECT * FROM building ORDER BY id")
    return render_template('admin.html', rooms=rooms, violations=violations, buildings=buildings)


@app.route('/admin/seat/add', methods=['POST'])
@admin_required
def add_seat():
    room_id = request.form.get('room_id', 0)
    seat_label = request.form.get('seat_label', '').strip()
    has_power = 1 if request.form.get('has_power') else 0
    near_window = 1 if request.form.get('near_window') else 0
    try:
        from db import execute
        execute("INSERT INTO seat (room_id, seat_label, has_power, near_window) VALUES (?,?,?,?)",
                (room_id, seat_label, has_power, near_window))
        flash(f"座位 {seat_label} 添加成功", 'success')
    except Exception as e:
        flash(f"添加失败: {e}", 'error')
    return redirect(url_for('admin_index'))


@app.route('/admin/seat/toggle/<int:seat_id>', methods=['POST'])
@admin_required
def toggle_seat(seat_id):
    s = query("SELECT status FROM seat WHERE id=?", (seat_id,), one=True)
    if s:
        new = 'maintenance' if s['status'] == 'available' else 'available'
        from db import execute
        execute("UPDATE seat SET status=? WHERE id=?", (new, seat_id))
        flash(f"座位状态已切换为 {new}", 'success')
    return redirect(url_for('admin_index'))


@app.route('/admin/seat/delete/<int:seat_id>', methods=['POST'])
@admin_required
def delete_seat(seat_id):
    try:
        from db import execute
        execute("DELETE FROM seat WHERE id=?", (seat_id,))
        flash('座位已删除', 'success')
    except Exception as e:
        flash(f"删除失败: {e}", 'error')
    return redirect(url_for('admin_index'))


@app.route('/admin/room/add', methods=['POST'])
@admin_required
def add_room():
    try:
        from db import execute
        execute("INSERT INTO room (building_id, name, floor, capacity, description) VALUES (?,?,?,?,?)",
                (request.form.get('building_id'), request.form.get('name'),
                 request.form.get('floor', 1), request.form.get('capacity', 30),
                 request.form.get('description', '')))
        flash("自习室添加成功", 'success')
    except Exception as e:
        flash(f"添加失败: {e}", 'error')
    return redirect(url_for('admin_index'))


# ========== Start ==========
if __name__ == '__main__':
    init_db()
    print("Starting Seat Reservation System on Hugging Face...")
    app.run(host='0.0.0.0', port=7860, debug=False)
