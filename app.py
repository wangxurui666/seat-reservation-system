from flask import Flask, session, redirect, url_for, request
from config import SECRET_KEY

app = Flask(__name__)
app.secret_key = SECRET_KEY


def init_db():
    """创建默认管理员（数据库已通过 db.sql 初始化）"""
    import bcrypt
    from models.db import query, execute as db_execute

    admin = query('SELECT id FROM user WHERE username = %s', ('admin',), one=True)
    if not admin:
        hashed = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt(rounds=12))
        db_execute(
            'INSERT INTO user (username, password, real_name, student_id, role) VALUES (%s, %s, %s, %s, %s)',
            ('admin', hashed.decode(), '系统管理员', '000000', 'admin')
        )
        print('管理员账号已创建: admin / admin123')


@app.before_request
def verify_session_user():
    """每次请求前验证 session 用户是否存在（防止数据库重建后 session 失效）"""
    if session.get('user_id'):
        from models.db import query
        user = query('SELECT id FROM user WHERE id = %s', (session['user_id'],), one=True)
        if not user:
            session.clear()


@app.context_processor
def inject_globals():
    """模板全局变量"""
    return dict(
        session_user=dict(
            id=session.get('user_id'),
            username=session.get('username'),
            real_name=session.get('real_name'),
            role=session.get('role'),
        ) if session.get('user_id') else None
    )


# 注册蓝图
from controllers.auth import auth_bp
from controllers.seat import seat_bp
from controllers.admin import admin_bp

app.register_blueprint(auth_bp)
app.register_blueprint(seat_bp)
app.register_blueprint(admin_bp)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
