from flask import Blueprint, request, render_template, redirect, url_for, session, flash
from functools import wraps
from models.db import query, execute

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            flash('请先登录', 'error')
            return redirect(url_for('auth.login'))
        if session.get('role') != 'admin':
            flash('需要管理员权限', 'error')
            return redirect(url_for('seat.index'))
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/')
@admin_required
def index():
    """管理后台首页"""
    rooms = query('''
        SELECT r.*, b.name AS building_name
        FROM room r
        JOIN building b ON b.id = r.building_id
        ORDER BY b.id, r.floor, r.name
    ''')
    violations = query('''
        SELECT v.*, u.real_name, u.student_id, r.reserve_date, s.seat_label
        FROM violation v
        JOIN user u ON u.id = v.user_id
        LEFT JOIN reservation res ON res.id = v.reservation_id
        LEFT JOIN seat s ON s.id = res.seat_id
        LEFT JOIN reservation r ON r.id = v.reservation_id
        ORDER BY v.created_at DESC
        LIMIT 50
    ''')

    buildings = query('SELECT * FROM building ORDER BY id')

    return render_template('admin.html',
        rooms=rooms,
        violations=violations,
        buildings=buildings,
    )


@admin_bp.route('/seat/add', methods=['POST'])
@admin_required
def add_seat():
    room_id = int(request.form.get('room_id', 0))
    seat_label = request.form.get('seat_label', '').strip()
    has_power = 1 if request.form.get('has_power') else 0
    near_window = 1 if request.form.get('near_window') else 0

    if room_id and seat_label:
        try:
            execute(
                'INSERT INTO seat (room_id, seat_label, has_power, near_window) VALUES (%s, %s, %s, %s)',
                (room_id, seat_label, has_power, near_window)
            )
            flash(f'座位 {seat_label} 添加成功', 'success')
        except Exception as e:
            flash(f'添加失败: {str(e)}', 'error')
    return redirect(url_for('admin.index'))


@admin_bp.route('/seat/toggle/<int:seat_id>', methods=['POST'])
@admin_required
def toggle_seat(seat_id):
    seat = query('SELECT status FROM seat WHERE id = %s', (seat_id,), one=True)
    if seat:
        new_status = 'maintenance' if seat['status'] == 'available' else 'available'
        execute('UPDATE seat SET status = %s WHERE id = %s', (new_status, seat_id))
        flash(f'座位状态已切换为 {new_status}', 'success')
    return redirect(url_for('admin.index'))


@admin_bp.route('/seat/delete/<int:seat_id>', methods=['POST'])
@admin_required
def delete_seat(seat_id):
    try:
        execute('DELETE FROM seat WHERE id = %s', (seat_id,))
        flash('座位已删除', 'success')
    except Exception as e:
        flash(f'删除失败（可能有预约记录关联）: {str(e)}', 'error')
    return redirect(url_for('admin.index'))


@admin_bp.route('/room/add', methods=['POST'])
@admin_required
def add_room():
    building_id = int(request.form.get('building_id', 0))
    name = request.form.get('name', '').strip()
    floor = int(request.form.get('floor', 1))
    capacity = int(request.form.get('capacity', 30))
    description = request.form.get('description', '').strip()

    if building_id and name:
        execute(
            'INSERT INTO room (building_id, name, floor, capacity, description) VALUES (%s, %s, %s, %s, %s)',
            (building_id, name, floor, capacity, description)
        )
        flash(f'自习室 {name} 添加成功', 'success')
    return redirect(url_for('admin.index'))
