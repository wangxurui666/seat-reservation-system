import pymysql
import pymysql.cursors
from config import DB_CONFIG


def get_db():
    """获取数据库连接（DictCursor 方便模板渲染）"""
    return pymysql.connect(
        **DB_CONFIG,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def query(sql, params=None, one=False):
    """执行查询并返回结果"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if one:
                return cur.fetchone()
            return cur.fetchall()
    finally:
        conn.close()


def execute(sql, params=None):
    """执行写操作（INSERT/UPDATE/DELETE），返回受影响行数"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            n = cur.execute(sql, params)
            conn.commit()
            return n
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_sql_file(filepath):
    """执行 .sql 文件中的所有语句（用于初始化数据库）"""
    conn = pymysql.connect(**{k: v for k, v in DB_CONFIG.items() if k != 'cursorclass'})
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_text = f.read()
        # 按 ; 分割语句，跳过空语句和注释行
        statements = []
        delimiter = False
        current = []
        for line in sql_text.split('\n'):
            if line.strip().startswith('DELIMITER'):
                delimiter = True
                continue
            if delimiter:
                if line.strip() == '//':
                    delimiter = False
                    statements.append('\n'.join(current))
                    current = []
                else:
                    current.append(line)
            else:
                stripped = line.strip()
                if stripped and not stripped.startswith('--'):
                    current.append(line)
                if stripped.endswith(';') and not delimiter:
                    stmt = '\n'.join(current).strip()
                    if stmt and stmt != ';':
                        statements.append(stmt.rstrip(';'))
                    current = []

        with conn.cursor() as cur:
            for stmt in statements:
                if stmt.strip():
                    try:
                        cur.execute(stmt)
                    except Exception as e:
                        pass  # skip errors for already-existing objects
            conn.commit()
    finally:
        conn.close()
