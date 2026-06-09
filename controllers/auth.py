from flask import Blueprint, request, render_template, redirect, url_for, session, flash
import bcrypt
from models.db import query, execute

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        user = query(
            'SELECT id, username, password, real_name, role FROM user WHERE username = %s',
            (username,), one=True
        )

        if user and bcrypt.checkpw(password.encode(), user['password'].encode()):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['real_name'] = user['real_name']
            session['role'] = user['role']
            flash(f'欢迎回来，{user["real_name"]}！', 'success')
            return redirect(url_for('seat.index'))

        flash('用户名或密码错误', 'error')

    return render_template('login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        real_name = request.form.get('real_name', '').strip()
        student_id = request.form.get('student_id', '').strip()

        if not all([username, password, real_name]):
            flash('请填写所有必填字段', 'error')
            return render_template('register.html')

        # 检查用户名是否已存在
        exist = query(
            'SELECT id FROM user WHERE username = %s OR student_id = %s',
            (username, student_id), one=True
        )
        if exist:
            flash('用户名或学号已被注册', 'error')
            return render_template('register.html')

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
        execute(
            'INSERT INTO user (username, password, real_name, student_id) VALUES (%s, %s, %s, %s)',
            (username, hashed.decode(), real_name, student_id)
        )
        flash('注册成功，请登录', 'success')
        return redirect(url_for('auth.login'))

    return render_template('register.html')


@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('已退出登录', 'info')
    return redirect(url_for('auth.login'))
