import os
import mysql.connector
from mysql.connector import pooling

_pool = None


def get_pool():
    global _pool
    if _pool is not None:
        return _pool

    db_config = {
        'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
        'port': int(os.environ.get('MYSQL_PORT', '3306')),
        'user': os.environ.get('MYSQL_USER', 'root'),
        'password': os.environ.get('MYSQL_PASSWORD', ''),
        'database': os.environ.get('MYSQL_DATABASE', 'librarydb'),
    }

    # Create a connection pool. If the database does not exist, try to create it (best-effort).
    try:
        _pool = pooling.MySQLConnectionPool(pool_name='libpool', pool_size=5, **db_config)
        return _pool
    except Exception as e:
        # If unknown database, try to create it and retry
        try:
            from mysql.connector import connect, Error
            err_msg = str(e)
            # common MySQL error code for unknown database is 1049
            if '1049' in err_msg or 'Unknown database' in err_msg:
                tmp_cfg = dict(db_config)
                db_name = tmp_cfg.pop('database', None)
                # connect without database
                conn = connect(**tmp_cfg)
                cur = conn.cursor()
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
                conn.commit()
                cur.close()
                conn.close()
                # retry pool creation
                _pool = pooling.MySQLConnectionPool(pool_name='libpool', pool_size=5, **db_config)
                return _pool
        except Exception:
            pass
        # re-raise original
        raise


def get_db():
    # Try to reuse a connection stored on flask.g for the current request context
    try:
        from flask import g
    except Exception:
        g = None

    pool = get_pool()
    if g is not None:
        conn = getattr(g, '_db_conn', None)
        if conn is not None:
            try:
                # ensure connection is still usable
                if conn.is_connected():
                    return conn
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass

        # allocate new connection and store on g
        conn = pool.get_connection()
        setattr(g, '_db_conn', conn)
        return conn

    # fallback when no flask context: return a fresh connection
    conn = pool.get_connection()
    return conn


def init_db():
    """Create tables if they do not exist using bundled schema.sql (best-effort).
    """
    here = os.path.dirname(__file__)
    schema_path = os.path.join(here, 'schema.sql')
    if not os.path.exists(schema_path):
        print('schema.sql not found, skipping init')
        return

    with open(schema_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    # split on ; for simple execution
    conn = get_db()
    cur = conn.cursor()
    for stmt in sql.split(';'):
        s = stmt.strip()
        if not s:
            continue
        try:
            cur.execute(s)
        except Exception as e:
            # best-effort, continue
            print('init_db statement failed:', e)
    conn.commit()
    cur.close()
    conn.close()
