
from flask import Flask, request, jsonify, send_from_directory, make_response, g, render_template, session
import logging
import os
from dotenv import load_dotenv
from db import get_db, init_db
from passlib.hash import pbkdf2_sha256
import jwt
from datetime import datetime, timedelta, timezone
from uuid import uuid4

# Load environment variables from .env file
load_dotenv()

# Basic configuration
SECRET = os.environ.get('LIBRARY_SECRET', 'change-me-in-production')
ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configure basic logging for development
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger(__name__)
# enable more verbose logs for werkzeug and mysql connector during dev
logging.getLogger('werkzeug').setLevel(logging.DEBUG)
logging.getLogger('mysql.connector').setLevel(logging.DEBUG)
app.logger.setLevel(logging.DEBUG)


@app.teardown_appcontext
def close_db_on_teardown(exc):
	# Close any DB connection stored on flask.g to avoid connection leaks
	try:
		from flask import g
		conn = getattr(g, '_db_conn', None)
		if conn:
			try:
				conn.close()
			except Exception:
				pass
			try:
				delattr(g, '_db_conn')
			except Exception:
				pass
	except Exception:
		pass

def error_response(message="Error", status_code=400, error_code=None):
    from flask import jsonify
    return jsonify({'status': 'error', 'message': message, 'error_code': error_code, 'timestamp': datetime.utcnow().isoformat()}), status_code

def create_access_token(user_id, expires_delta=None):
	expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
	payload = {'user_id': user_id, 'exp': expire}
	token = jwt.encode(payload, SECRET, algorithm='HS256')
	return token


def verify_access_token(token):
	try:
		payload = jwt.decode(token, SECRET, algorithms=['HS256'])
		return payload.get('user_id')
	except Exception:
		return None


def require_auth(fn):
	def wrapper(*args, **kwargs):
		auth = request.headers.get('Authorization', '')
		token = None
		if auth.startswith('Bearer '):
			token = auth.split(' ', 1)[1].strip()
		else:
			token = request.cookies.get('auth')

		user_id = None
		if token:
			user_id = verify_access_token(token)
		if not user_id:
			return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
		g.user_id = user_id
		return fn(*args, **kwargs)
	wrapper.__name__ = fn.__name__
	return wrapper


@app.route('/api/health')
def health():
	return jsonify({'status': 'success', 'message': 'ok'})


@app.route('/api/_debug/books_count')
def debug_books_count():
	# debugging helper to show how many books the Flask process sees
	try:
		db = get_db()
		cur = db.cursor()
		cur.execute('SELECT COUNT(*) FROM books')
		cnt = cur.fetchone()[0]
		cur.close()
		# include a few environment variables so we can compare environments
		env_info = {
			'MYSQL_HOST': os.environ.get('MYSQL_HOST'),
			'MYSQL_PORT': os.environ.get('MYSQL_PORT'),
			'MYSQL_USER': os.environ.get('MYSQL_USER'),
			'MYSQL_DATABASE': os.environ.get('MYSQL_DATABASE'),
		}
		try:
			db_name = getattr(db, 'database', None)
		except Exception:
			db_name = None
		try:
			server_host = getattr(db, 'server_host', None)
		except Exception:
			server_host = None
		db.close()
		return jsonify({'status':'success','data':{'count': cnt, 'env': env_info, 'db_database_attr': db_name, 'db_server_host_attr': server_host}})
	except Exception as e:
		return jsonify({'status':'error','message': str(e)})


@app.route('/api/auth/register', methods=['POST'])
def register():
	body = request.get_json() or {}
	name = body.get('name') or body.get('fullname')
	email = body.get('email')
	password = body.get('password')
	if not email or not password:
		return jsonify({'status': 'error', 'message': 'email and password required'}), 400

	db = get_db()
	cur = db.cursor()
	cur.execute('SELECT id FROM users WHERE email = %s', (email,))
	if cur.fetchone():
		return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

	hashed = pbkdf2_sha256.hash(password)
	cur.execute('INSERT INTO users (name, email, password, created_at, status) VALUES (%s,%s,%s,NOW(),%s)', (name, email, hashed, 'active'))
	db.commit()
	uid = cur.lastrowid
	return jsonify({'status': 'success', 'data': {'user_id': uid}})


@app.route('/api/auth/login', methods=['POST'])
def login():
	body = request.get_json() or {}
	email = body.get('email')
	password = body.get('password')
	if not email or not password:
		return jsonify({'status': 'error', 'message': 'email and password required'}), 400

	db = get_db()
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT id, password, is_admin FROM users WHERE email = %s', (email,))
	row = cur.fetchone()
	if not row or not row.get('password') or not pbkdf2_sha256.verify(password, row['password']):
		return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401

	access = create_access_token(row['id'])
	# create refresh token (simple random string)
	import uuid
	refresh = str(uuid.uuid4())
	cur.execute('INSERT INTO refresh_tokens (user_id, token, created_at) VALUES (%s,%s,NOW())', (row['id'], refresh))
	db.commit()

	return jsonify({'status': 'success', 'data': {'access_token': access, 'refresh_token': refresh, 'user_id': row['id'], 'is_admin': bool(row.get('is_admin', False))}})


@app.route('/api/auth/admin/login', methods=['POST'])
def admin_login():
	body = request.get_json() or {}
	email = body.get('email')
	password = body.get('password')
	db = get_db()
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT id, password, is_admin FROM users WHERE email = %s', (email,))
	row = cur.fetchone()
	if not row or not row.get('is_admin') or not row.get('password') or not pbkdf2_sha256.verify(password, row['password']):
		return jsonify({'status': 'error', 'message': 'Invalid admin credentials'}), 401

	access = create_access_token(row['id'])
	import uuid
	refresh = str(uuid.uuid4())
	cur.execute('INSERT INTO refresh_tokens (user_id, token, created_at) VALUES (%s,%s,NOW())', (row['id'], refresh))
	db.commit()
	return jsonify({'status': 'success', 'data': {'access_token': access, 'refresh_token': refresh, 'admin_id': row['id'], 'role': 'admin'}})


@app.route('/api/auth/refresh-token', methods=['POST'])
def refresh_token():
	body = request.get_json() or {}
	token = body.get('refresh_token') or request.form.get('refresh_token')
	if not token:
		return jsonify({'status': 'error', 'message': 'refresh_token required'}), 400
	db = get_db()
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT user_id FROM refresh_tokens WHERE token = %s', (token,))
	row = cur.fetchone()
	if not row:
		return jsonify({'status': 'error', 'message': 'Invalid refresh token'}), 401
	user_id = row['user_id']
	access = create_access_token(user_id)
	return jsonify({'status': 'success', 'data': {'access_token': access, 'refresh_token': token, 'user_id': user_id}})


@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
	"""Create a password reset token for a user. In production this should send an email.
	For dev/testing we return the token in the response so it can be used in the reset step.
	"""
	body = request.get_json() or {}
	email = body.get('email')
	if not email:
		return jsonify({'status': 'error', 'message': 'email required'}), 400

	db = get_db()
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT id FROM users WHERE email = %s', (email,))
	row = cur.fetchone()
	if not row:
		# Do not reveal whether email exists in production; here we return success for UX
		return jsonify({'status': 'success', 'message': 'If the email exists, a reset link was sent'})

	user_id = row['id']
	token = str(uuid4())
	expires = datetime.now(timezone.utc) + timedelta(hours=1)
	cur.execute('INSERT INTO password_resets (user_id, token, expires_at, used, created_at) VALUES (%s,%s,%s,0,NOW())',
				(user_id, token, expires))
	db.commit()

	# NOTE: In production, send token via email. For now return token for testing/dev.
	return jsonify({'status': 'success', 'data': {'reset_token': token, 'expires_at': expires.isoformat()}})


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
	"""Reset password using token generated by forgot-password endpoint."""
	body = request.get_json() or {}
	token = body.get('token')
	new_password = body.get('new_password')
	if not token or not new_password:
		return jsonify({'status': 'error', 'message': 'token and new_password required'}), 400

	db = get_db()
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT id, user_id, expires_at, used FROM password_resets WHERE token = %s', (token,))
	row = cur.fetchone()
	if not row:
		return jsonify({'status': 'error', 'message': 'Invalid token'}), 400

	if row.get('used'):
		return jsonify({'status': 'error', 'message': 'Token already used'}), 400

	expires_at = row.get('expires_at')
	if not expires_at or expires_at < datetime.now(timezone.utc):
		return jsonify({'status': 'error', 'message': 'Token expired'}), 400

	user_id = row['user_id']
	hashed = pbkdf2_sha256.hash(new_password)
	cur.execute('UPDATE users SET password = %s WHERE id = %s', (hashed, user_id))
	cur.execute('UPDATE password_resets SET used = 1 WHERE id = %s', (row['id'],))
	db.commit()

	return jsonify({'status': 'success', 'message': 'Password updated'})


@app.route('/api/auth/bootstrap-session', methods=['POST'])
def bootstrap_session():
	# sets cookie for SSR pages (optional)
	auth = request.headers.get('Authorization', '')
	token = None
	if auth.startswith('Bearer '):
		token = auth.split(' ', 1)[1].strip()
	elif request.cookies.get('auth'):
		token = request.cookies.get('auth')
	if not token:
		return jsonify({'status': 'error', 'message': 'No token provided'}), 400
	user_id = verify_access_token(token)
	if not user_id:
		return jsonify({'status': 'error', 'message': 'Invalid token'}), 401
	resp = make_response(jsonify({'status': 'success'}))
	resp.set_cookie('auth', token, httponly=True)
	return resp


@app.route('/api/auth/logout', methods=['POST'])
def logout():
	body = request.get_json() or {}
	token = body.get('refresh_token')
	if token:
		db = get_db()
		cur = db.cursor()
		cur.execute('DELETE FROM refresh_tokens WHERE token = %s', (token,))
		db.commit()
	resp = make_response(jsonify({'status': 'success'}))
	resp.delete_cookie('auth')
	return resp


@app.route('/api/books', methods=['GET', 'POST'])
def books():
	db = get_db()
	cur = db.cursor(dictionary=True)
	if request.method == 'GET':
		# listing with optional search, category and sort
		q = request.args.get('search')
		category = request.args.get('category')
		sort = request.args.get('sort')
		limit = int(request.args.get('limit') or 100)
		params = []
		sql = "SELECT * FROM books WHERE 1=1"
		if q:
			sql += " AND (title LIKE %s OR author LIKE %s)"
			params.extend(['%'+q+'%','%'+q+'%'])
		if category and category.lower() != 'all':
			sql += " AND category = %s"
			params.append(category)
		# sorting
		if sort == 'newest':
			sql += " ORDER BY created_at DESC"
		elif sort == 'rating':
			sql += " ORDER BY rating DESC"
		elif sort == 'title_az':
			sql += " ORDER BY title ASC"
		else:
			sql += " ORDER BY id DESC"
		sql += " LIMIT %s"
		params.append(limit)
		cur.execute(sql, tuple(params))
		rows = cur.fetchall()

		# If caller provided Authorization token and user is subscriber, show price 0
		auth = request.headers.get('Authorization', '')
		user_is_sub = False
		if auth.startswith('Bearer '):
			token = auth.split(' ',1)[1].strip()
			uid = verify_access_token(token)
			if uid:
				try:
					ucur = db.cursor(dictionary=True)
					ucur.execute('SELECT is_subscriber FROM users WHERE id = %s', (uid,))
					urow = ucur.fetchone()
					user_is_sub = bool(urow and urow.get('is_subscriber'))
				except Exception:
					user_is_sub = False

		# adjust price field for subscriber
		out_books = []
		for b in rows:
			book = dict(b)
			if user_is_sub:
				book['display_price'] = 0.0
			else:
				# keep original price
				book['display_price'] = float(book.get('price') or 0)
			# Map availability: has_pdf => available / coming soon
			book['availability'] = 'Available' if book.get('has_pdf') else 'Coming Soon'
			out_books.append(book)

		return jsonify({'status': 'success', 'data': {'books': out_books}})

	# create book (protected)
	auth = request.headers.get('Authorization', '')
	if not auth.startswith('Bearer '):
		return jsonify({'status':'error','message':'Unauthorized'}),401
	token = auth.split(' ',1)[1].strip()
	uid = verify_access_token(token)
	if not uid:
		return jsonify({'status':'error','message':'Unauthorized'}),401

	body = request.get_json() or {}
	title = body.get('title')
	author = body.get('author')
	category = body.get('category')
	price = body.get('price') or 0
	total_copies = body.get('total_copies') or 1
	available_copies = body.get('available_copies') or total_copies
	description = body.get('description')

	cur.execute('INSERT INTO books (title,author,category,price,total_copies,available_copies,description,created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())',
				(title, author, category, price, total_copies, available_copies, description))
	db.commit()
	book_id = cur.lastrowid
	return jsonify({'status':'success','data':{'book_id': book_id}})


@app.route('/api/books/<int:book_id>', methods=['GET','PUT','DELETE'])
def book_detail(book_id):
	db = get_db()
	cur = db.cursor(dictionary=True)
	if request.method == 'GET':
		cur.execute('SELECT * FROM books WHERE id = %s', (book_id,))
		row = cur.fetchone()
		if not row:
			return jsonify({'status':'error','message':'Not found'}),404
		return jsonify({'status':'success','data': row})

	# protected actions
	auth = request.headers.get('Authorization', '')
	if not auth.startswith('Bearer '):
		return jsonify({'status':'error','message':'Unauthorized'}),401
	token = auth.split(' ',1)[1].strip()
	uid = verify_access_token(token)
	if not uid:
		return jsonify({'status':'error','message':'Unauthorized'}),401

	if request.method == 'PUT':
		body = request.get_json() or {}
		fields = []
		vals = []
		for k in ('title','price','available_copies','description','category','author'):
			if k in body:
				fields.append(f"{k} = %s")
				vals.append(body[k])
		if fields:
			vals.append(book_id)
			cur.execute('UPDATE books SET ' + ','.join(fields) + ' WHERE id = %s', tuple(vals))
			db.commit()
		return jsonify({'status':'success','message':'Book updated'})

	if request.method == 'DELETE':
		cur.execute('DELETE FROM books WHERE id = %s', (book_id,))
		db.commit()
		return jsonify({'status':'success','message':'Book deleted'})


@app.route('/api/books/stats')
@require_auth
def books_stats():
	db = get_db()
	cur = db.cursor()
	cur.execute('SELECT COUNT(*) FROM books')
	total = cur.fetchone()[0]
	cur.execute('SELECT SUM(available_copies) FROM books')
	avail = cur.fetchone()[0] or 0
	return jsonify({'status':'success','data':{'total_books': total, 'available_copies': avail, 'categories': 'n/a'}})


@app.route('/api/users', methods=['GET'])
@require_auth
def users():
	db = get_db()
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT id,name,email,created_at,status FROM users ORDER BY id DESC LIMIT 200')
	rows = cur.fetchall()
	return jsonify({'status':'success','data':{'users': rows}})


@app.route('/api/users/<int:user_id>', methods=['GET','PUT'])
@require_auth
def user_detail(user_id):
	db = get_db()
	cur = db.cursor(dictionary=True)
	if request.method == 'GET':
		cur.execute('SELECT id,name,email,created_at,status FROM users WHERE id = %s', (user_id,))
		row = cur.fetchone()
		if not row:
			return jsonify({'status':'error','message':'Not found'}),404
		return jsonify({'status':'success','data':row})

	body = request.get_json() or {}
	fields = []
	vals = []
	for k in ('name','email','status'):
		if k in body:
			fields.append(f"{k} = %s")
			vals.append(body[k])
	if fields:
		vals.append(user_id)
		cur.execute('UPDATE users SET ' + ','.join(fields) + ' WHERE id = %s', tuple(vals))
		db.commit()
	return jsonify({'status':'success','message':'User updated'})


@app.route('/api/users/<int:user_id>/status', methods=['PUT'])
@require_auth
def user_status(user_id):
	body = request.get_json() or {}
	status = body.get('status')
	if not status:
		return jsonify({'status':'error','message':'status required'}),400
	db = get_db()
	cur = db.cursor()
	cur.execute('UPDATE users SET status = %s WHERE id = %s', (status, user_id))
	db.commit()
	return jsonify({'status':'success'})


@app.route('/api/users/stats')
@require_auth
def users_stats():
	"""Get stats for the current authenticated user including borrowing info."""
	user_id = g.get('user_id')
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	# Get borrowing statistics
	cur.execute('''SELECT 
					COUNT(CASE WHEN status = 'borrowed' THEN 1 END) as current_borrowed,
					COUNT(CASE WHEN status = 'returned' THEN 1 END) as total_returned,
					COUNT(*) as total_borrowed
				  FROM borrowings WHERE user_id = %s''',
				(user_id,))
	borrow_stats = cur.fetchone() or {}
	
	# Get user info for profile stats
	cur.execute('SELECT id, created_at FROM users WHERE id = %s', (user_id,))
	user = cur.fetchone()
	
	return jsonify({'status':'success','data':{
		'current_borrowed': borrow_stats.get('current_borrowed', 0),
		'total_returned': borrow_stats.get('total_returned', 0),
		'total_borrowed': borrow_stats.get('total_borrowed', 0),
		'member_since': user.get('created_at') if user else None
	}})


@app.route('/api/users/profile', methods=['GET','PUT'])
@require_auth
def profile():
	user_id = g.get('user_id')
	db = get_db()
	cur = db.cursor(dictionary=True)
	if request.method == 'GET':
		cur.execute('SELECT id,name,email,created_at,status FROM users WHERE id = %s', (user_id,))
		row = cur.fetchone()
		return jsonify({'status':'success','data':row})

	body = request.get_json() or {}
	fields = []
	vals = []
	for k in ('name', 'phone', 'address'):
		if k in body:
			fields.append(f"{k} = %s")
			vals.append(body[k])
	if fields:
		vals.append(user_id)
		cur.execute('UPDATE users SET ' + ','.join(fields) + ' WHERE id = %s', tuple(vals))
		db.commit()
	return jsonify({'status':'success','message':'Profile updated'})


# ===== ADMIN API ENDPOINTS =====
@app.route('/api/admin/dashboard', methods=['GET'])
@require_auth
def admin_dashboard():
	"""Return admin dashboard stats"""
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	try:
		# Total users
		cur.execute('SELECT COUNT(*) as count FROM users')
		total_users = cur.fetchone()['count']
		
		# Total books
		cur.execute('SELECT COUNT(*) as count FROM books')
		total_books = cur.fetchone()['count']
		
		# Active subscribers
		cur.execute('SELECT COUNT(*) as count FROM users WHERE is_subscriber = 1 AND status = "active"')
		active_subscribers = cur.fetchone()['count']
		
		# Total revenue (approximate: count of subscribers * average book price)
		cur.execute('SELECT AVG(price) as avg_price FROM books')
		avg_price = cur.fetchone()['avg_price'] or 0
		total_revenue = active_subscribers * avg_price
		
		return jsonify({
			'status': 'success',
			'data': {
				'total_users': total_users,
				'total_books': total_books,
				'active_subscribers': active_subscribers,
				'total_revenue': round(total_revenue, 2),
				'monthly_growth': 5.2,
				'top_categories': []
			}
		})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/users', methods=['GET', 'PUT'])
@require_auth
def admin_users():
	"""Get all users or update user subscription status"""
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	if request.method == 'GET':
		try:
			# Get page and limit from query params
			page = int(request.args.get('page', 1))
			limit = int(request.args.get('limit', 20))
			offset = (page - 1) * limit
			
			cur.execute('SELECT id, name, email, status, is_subscriber, created_at FROM users ORDER BY created_at DESC LIMIT %s OFFSET %s', (limit, offset))
			users = cur.fetchall()
			
			# Get total count
			cur.execute('SELECT COUNT(*) as count FROM users')
			total = cur.fetchone()['count']
			
			return jsonify({
				'status': 'success',
				'data': {
					'users': users,
					'total': total,
					'page': page,
					'limit': limit
				}
			})
		except Exception as e:
			return jsonify({'status': 'error', 'message': str(e)}), 500
	
	if request.method == 'PUT':
		try:
			body = request.get_json() or {}
			user_id = body.get('user_id')
			is_subscriber = body.get('is_subscriber')
			
			if not user_id or is_subscriber is None:
				return jsonify({'status': 'error', 'message': 'user_id and is_subscriber required'}), 400
			
			cur.execute('UPDATE users SET is_subscriber = %s WHERE id = %s', (is_subscriber, user_id))
			db.commit()
			
			return jsonify({'status': 'success', 'message': f'User {user_id} subscription updated'})
		except Exception as e:
			return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/books/add', methods=['POST'])
@require_auth
def admin_add_book():
	"""Add a new book (admin only)"""
	db = get_db()
	cur = db.cursor()
	
	try:
		body = request.get_json() or {}
		title = body.get('title')
		author = body.get('author')
		category = body.get('category')
		price = float(body.get('price', 0))
		description = body.get('description', '')
		total_copies = int(body.get('total_copies', 1))
		available_copies = int(body.get('available_copies', total_copies))
		rating = int(body.get('rating', 0))
		reviews = int(body.get('reviews', 0))
		image_url = body.get('image_url', '')
		has_pdf = int(body.get('has_pdf', 0))
		
		if not title or not author:
			return jsonify({'status': 'error', 'message': 'title and author required'}), 400
		
		cur.execute('''
			INSERT INTO books (title, author, category, price, description, total_copies, available_copies, rating, reviews, image_url, has_pdf, created_at)
			VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
		''', (title, author, category, price, description, total_copies, available_copies, rating, reviews, image_url, has_pdf))
		db.commit()
		
		book_id = cur.lastrowid
		return jsonify({'status': 'success', 'data': {'book_id': book_id, 'message': 'Book added successfully'}})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/books/update/<int:book_id>', methods=['PUT'])
@require_auth
def admin_update_book(book_id):
	"""Update a book (admin only)"""
	db = get_db()
	cur = db.cursor()
	
	try:
		body = request.get_json() or {}
		
		# Build update query dynamically
		fields = []
		vals = []
		for key in ('title', 'author', 'category', 'price', 'description', 'available_copies', 'rating', 'reviews', 'image_url', 'has_pdf'):
			if key in body:
				fields.append(f"{key} = %s")
				vals.append(body[key])
		
		if not fields:
			return jsonify({'status': 'error', 'message': 'No fields to update'}), 400
		
		vals.append(book_id)
		cur.execute(f'UPDATE books SET {",".join(fields)} WHERE id = %s', tuple(vals))
		db.commit()
		
		return jsonify({'status': 'success', 'message': 'Book updated successfully'})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/books/delete/<int:book_id>', methods=['DELETE'])
@require_auth
def admin_delete_book(book_id):
	"""Delete a book (admin only)"""
	db = get_db()
	cur = db.cursor()
	
	try:
		cur.execute('DELETE FROM books WHERE id = %s', (book_id,))
		db.commit()
		
		return jsonify({'status': 'success', 'message': 'Book deleted successfully'})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['GET', 'PUT'])
@require_auth
def admin_user_detail(user_id):
	"""Get user details or update user status (admin only)"""
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	if request.method == 'GET':
		try:
			# Get user details
			cur.execute('''
				SELECT id, name, email, phone, location, status, is_subscriber, created_at
				FROM users WHERE id = %s
			''', (user_id,))
			user = cur.fetchone()
			
			if not user:
				return jsonify({'status': 'error', 'message': 'User not found'}), 404
			
			# Get user borrowing stats
			cur.execute('''
				SELECT COUNT(*) as total_borrowed, 
					   COALESCE(SUM(CASE WHEN return_date IS NULL THEN 1 ELSE 0 END), 0) as currently_borrowed
				FROM borrowings WHERE user_id = %s
			''', (user_id,))
			borrow_stats = cur.fetchone() or {'total_borrowed': 0, 'currently_borrowed': 0}
			
			# Get user's borrowing history
			cur.execute('''
				SELECT b.id, b.title, b.author, br.borrow_date, br.due_date, br.return_date
				FROM borrowings br
				JOIN books b ON br.book_id = b.id
				WHERE br.user_id = %s
				ORDER BY br.borrow_date DESC
				LIMIT 10
			''', (user_id,))
			borrowing_history = cur.fetchall() or []
			
			return jsonify({
				'status': 'success',
				'data': {
					'user': user,
					'borrow_stats': borrow_stats,
					'borrowing_history': borrowing_history
				}
			})
		except Exception as e:
			return jsonify({'status': 'error', 'message': str(e)}), 500
	
	if request.method == 'PUT':
		try:
			body = request.get_json() or {}
			status = body.get('status')
			is_subscriber = body.get('is_subscriber')
			
			if status:
				if status not in ['active', 'suspended', 'inactive']:
					return jsonify({'status': 'error', 'message': 'Invalid status'}), 400
				cur.execute('UPDATE users SET status = %s WHERE id = %s', (status, user_id))
			
			if is_subscriber is not None:
				cur.execute('UPDATE users SET is_subscriber = %s WHERE id = %s', (is_subscriber, user_id))
			
			db.commit()
			
			return jsonify({'status': 'success', 'message': f'User {user_id} updated successfully'})
		except Exception as e:
			return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/subscriptions', methods=['GET'])
@require_auth
def admin_subscriptions():
	"""Get all subscriptions with filtering and pagination"""
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	try:
		page = int(request.args.get('page', 1))
		limit = int(request.args.get('limit', 20))
		offset = (page - 1) * limit
		search = request.args.get('search', '')
		
		# Build where clause properly
		where_clause = "WHERE is_subscriber = 1"
		query_params = []
		count_params = []
		
		if search:
			where_clause += " AND (name LIKE %s OR email LIKE %s)"
			query_params.extend([f"%{search}%", f"%{search}%"])
			count_params.extend([f"%{search}%", f"%{search}%"])
		
		# Get subscriptions
		query = f'''
			SELECT id, name, email, created_at, is_subscriber, status,
				   0 as books_borrowed,
				   (SELECT COUNT(*) FROM borrowings WHERE user_id = users.id AND return_date IS NULL) as currently_borrowed
			FROM users
			{where_clause}
			ORDER BY created_at DESC
			LIMIT %s OFFSET %s
		'''
		query_params.extend([limit, offset])
		
		cur.execute(query, query_params)
		subscriptions = cur.fetchall() or []
		
		# Get total count
		count_query = f'SELECT COUNT(*) as count FROM users {where_clause}'
		cur.execute(count_query, count_params)
		total_row = cur.fetchone()
		total = total_row['count'] if total_row else 0
		
		return jsonify({
			'status': 'success',
			'data': {
				'subscriptions': subscriptions,
				'total': total,
				'page': page,
				'limit': limit
			}
		})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/admin/subscriptions/<int:sub_id>', methods=['PUT'])
@require_auth
def admin_update_subscription(sub_id):
	"""Update subscription (suspend/resume/change plan)"""
	db = get_db()
	cur = db.cursor()
	
	try:
		body = request.get_json() or {}
		action = body.get('action')  # suspend, resume, downgrade
		
		if action == 'suspend':
			cur.execute('UPDATE users SET is_subscriber = 0, status = "suspended" WHERE id = %s', (sub_id,))
		elif action == 'resume':
			cur.execute('UPDATE users SET is_subscriber = 1, status = "active" WHERE id = %s', (sub_id,))
		elif action == 'downgrade':
			cur.execute('UPDATE users SET is_subscriber = 0 WHERE id = %s', (sub_id,))
		else:
			return jsonify({'status': 'error', 'message': 'Invalid action'}), 400
		
		db.commit()
		
		return jsonify({'status': 'success', 'message': f'Subscription {action} successfully'})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


# @app.route('/api/admin/activity', methods=['GET'])
# @require_auth
# def admin_activity():
# 	"""Get recent system activity"""
# 	db = get_db()
# 	cur = db.cursor(dictionary=True)
	
# 	try:
# 		limit = int(request.args.get('limit', 20))
		
# 		# Get recent borrows
# 		cur.execute('''
# 			SELECT br.id, u.name as user_name, b.title as book_title, 'borrow' as action, br.borrow_date as timestamp
# 			FROM borrowings br
# 			JOIN users u ON br.user_id = u.id
# 			JOIN books b ON br.book_id = b.id
# 			WHERE br.borrow_date IS NOT NULL
			
# 			UNION ALL
			
# 			SELECT br.id, u.name as user_name, b.title as book_title, 'return' as action, br.return_date as timestamp
# 			FROM borrowings br
# 			JOIN users u ON br.user_id = u.id
# 			JOIN books b ON br.book_id = b.id
# 			WHERE br.return_date IS NOT NULL
			
# 			ORDER BY timestamp DESC
# 			LIMIT %s
# 		''', (limit,))
		
# 		activities = cur.fetchall()
		
# 		return jsonify({
# 			'status': 'success',
# 			'data': activities
# 		})
# 	except Exception as e:
# 		return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/admin/activity', methods=['GET'])
@require_auth
def admin_activity():
    """Get recent system activity in the format expected by frontend"""
    db = get_db()
    cur = db.cursor(dictionary=True)
    
    try:
        limit = int(request.args.get('limit', 10))
        
        # Get comprehensive recent activity
        cur.execute('''
            (SELECT 
                'user_registered' as type,
                'New User' as title,
                CONCAT(u.name, ' registered to the platform') as description,
                u.created_at as timestamp
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT %s)
            
            UNION ALL
            
            (SELECT 
                'book_added' as type,
                'Book Added' as title,
                CONCAT('"', b.title, '" added to system') as description,
                b.created_at as timestamp
            FROM books b
            ORDER BY b.created_at DESC
            LIMIT %s)
            
            UNION ALL
            
            (SELECT 
                'book_borrowed' as type,
                'Book Borrowed' as title,
                CONCAT('"', b.title, '" borrowed by ', u.name) as description,
                br.borrowed_at as timestamp
            FROM borrowings br
            JOIN books b ON br.book_id = b.id
            JOIN users u ON br.user_id = u.id
            WHERE br.status = 'borrowed'
            ORDER BY br.borrowed_at DESC
            LIMIT %s)
            
            UNION ALL
            
            (SELECT 
                'book_returned' as type,
                'Book Returned' as title,
                CONCAT('"', b.title, '" returned by ', u.name) as description,
                br.returned_at as timestamp
            FROM borrowings br
            JOIN books b ON br.book_id = b.id
            JOIN users u ON br.user_id = u.id
            WHERE br.status = 'returned' AND br.returned_at IS NOT NULL
            ORDER BY br.returned_at DESC
            LIMIT %s)
            
            ORDER BY timestamp DESC
            LIMIT %s
        ''', (limit, limit, limit, limit, limit))
        
        activities = cur.fetchall()
        
        # Format the response to match frontend expectations
        formatted_activities = []
        for activity in activities:
            formatted_activities.append({
                'type': activity['type'],
                'title': activity['title'],
                'description': activity['description'],
                'timestamp': activity['timestamp'].isoformat() if activity['timestamp'] else datetime.now(timezone.utc).isoformat()
            })
        
        return jsonify({
            'status': 'success',
            'data': formatted_activities
        })
        
    except Exception as e:
        logger.error(f"Error fetching admin activity: {str(e)}")
        return jsonify
	
@app.route('/api/admin/profile', methods=['GET'])
@require_auth
def admin_profile():
	"""Get logged-in admin's profile"""
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	try:
		user_id = session.get('user_id')
		
		cur.execute('''
			SELECT id, name, email, phone, location, status, is_subscriber, created_at
			FROM users WHERE id = %s
		''', (user_id,))
		admin = cur.fetchone()
		
		if not admin:
			return jsonify({'status': 'error', 'message': 'Admin not found'}), 404
		
		# Get admin stats
		cur.execute('''
			SELECT 
				(SELECT COUNT(*) FROM users) as total_users,
				(SELECT COUNT(*) FROM books) as total_books,
				(SELECT COUNT(*) FROM borrowings WHERE return_date IS NULL) as active_borrowings
		''')
		stats = cur.fetchone()
		
		return jsonify({
			'status': 'success',
			'data': {
				'admin': admin,
				'stats': stats
			}
		})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500


# ===== USER PAGE ROUTES =====
@app.route('/dashboard')
def dashboard_page():
	return render_template('dashboard.html')


@app.route('/users/profile')
def profile_page():
	return render_template('users/profile.html')


@app.route('/library/books.html')
@app.route('/library/books')
def books_page():
	return render_template('library/books.html')


@app.route('/auth/login')
def user_login_page():
	return send_from_directory('static', 'auth/login.html')


@app.route('/auth/register')
def user_register_page():
	return send_from_directory('static', 'auth/register.html')


@app.route('/auth/forgot-password')
def user_forgot_password_page():
	return send_from_directory('static', 'auth/user-forgot-password.html')


# ===== ADMIN ROUTES =====
@app.route('/admin')
def admin_index():
	return render_template('admin/authentication/login.html')


@app.route('/admin/login')
def admin_login_page():
	return render_template('admin/authentication/login.html')


@app.route('/admin/signup')
def admin_signup_page():
	return render_template('admin/authentication/signup.html')


@app.route('/admin/forgot-password')
def admin_forgot_password_page():
	return render_template('admin/authentication/admin-forgot-password.html')


@app.route('/admin/dashboard')
def admin_dashboard_page():
	return render_template('admin/dashboard.html')


@app.route('/admin/library')
@app.route('/admin/library/books')
def admin_library_books_page():
	return render_template('admin/library_/book_management.html')


@app.route('/admin/library/add-book')
def admin_add_book_page():
	return render_template('admin/library_/book_management.html')


@app.route('/admin/library/manage-books')
def admin_manage_books_page():
	return render_template('admin/library_/book_management.html')


@app.route('/admin/library/remove-book')
def admin_remove_book_page():
	return render_template('admin/library_/book_management.html')


@app.route('/admin/usermanagement')
def admin_usermanagement_page():
	return render_template('admin/usermanagement/view_members.html')


@app.route('/admin/usermanagement/view-members')
def admin_view_members_page():
	return render_template('admin/usermanagement/view_members.html')


@app.route('/admin/usermanagement/subscriptions')
def admin_subscriptions_page():
	return render_template('admin/usermanagement/user_subscriptions.html')


# ===== BORROWING ENDPOINTS =====
@app.route('/api/borrow', methods=['POST'])
@require_auth
def borrow_book():
	"""Borrow a book. Requires authentication."""
	db = get_db()
	body = request.get_json() or {}
	book_id = body.get('book_id')
	
	if not book_id:
		return jsonify({'status': 'error', 'message': 'book_id required'}), 400
	
	user_id = g.user_id
	
	# Check if book exists and has available copies
	cur = db.cursor(dictionary=True)
	cur.execute('SELECT id, available_copies, total_copies FROM books WHERE id = %s', (book_id,))
	book = cur.fetchone()
	
	if not book:
		return jsonify({'status': 'error', 'message': 'Book not found'}), 404
	
	if book['available_copies'] <= 0:
		return jsonify({'status': 'error', 'message': 'No copies available'}), 400
	
	# Check if user already has this book borrowed (not returned)
	cur.execute('SELECT id FROM borrowings WHERE user_id = %s AND book_id = %s AND status = %s',
				(user_id, book_id, 'borrowed'))
	if cur.fetchone():
		return jsonify({'status': 'error', 'message': 'You already have this book borrowed'}), 400
	
	# Set due date (14 days from now)
	due_at = datetime.now(timezone.utc) + timedelta(days=14)
	
	# Create borrowing record
	cur.execute('''INSERT INTO borrowings (user_id, book_id, borrowed_at, due_at, status, created_at)
				  VALUES (%s, %s, NOW(), %s, %s, NOW())''',
				(user_id, book_id, due_at, 'borrowed'))
	
	# Decrement available copies
	cur.execute('UPDATE books SET available_copies = available_copies - 1 WHERE id = %s', (book_id,))
	
	db.commit()
	borrowing_id = cur.lastrowid
	
	return jsonify({
		'status': 'success',
		'data': {
			'borrowing_id': borrowing_id,
			'book_id': book_id,
			'borrowed_at': datetime.now(timezone.utc).isoformat(),
			'due_at': due_at.isoformat(),
			'message': 'Book borrowed successfully'
		}
	})


@app.route('/api/return-book', methods=['POST'])
@require_auth
def return_book():
	"""Return a borrowed book."""
	db = get_db()
	body = request.get_json() or {}
	book_id = body.get('book_id')
	
	if not book_id:
		return jsonify({'status': 'error', 'message': 'book_id required'}), 400
	
	user_id = g.user_id
	
	# Find active borrowing
	cur = db.cursor(dictionary=True)
	cur.execute('''SELECT id, book_id FROM borrowings 
				  WHERE user_id = %s AND book_id = %s AND status = %s''',
				(user_id, book_id, 'borrowed'))
	borrowing = cur.fetchone()
	
	if not borrowing:
		return jsonify({'status': 'error', 'message': 'No active borrowing found'}), 404
	
	# Update borrowing status
	cur.execute('''UPDATE borrowings SET returned_at = NOW(), status = %s 
				  WHERE id = %s''',
				('returned', borrowing['id']))
	
	# Increment available copies
	cur.execute('UPDATE books SET available_copies = available_copies + 1 WHERE id = %s', (book_id,))
	
	db.commit()
	
	return jsonify({
		'status': 'success',
		'data': {
			'message': 'Book returned successfully',
			'returned_at': datetime.now(timezone.utc).isoformat()
		}
	})


@app.route('/api/users/<int:user_id>/borrowings', methods=['GET'])
@require_auth
def get_user_borrowings(user_id):
	"""Get borrowings for a user (auth required; can view own or admin)."""
	auth = request.headers.get('Authorization', '')
	token = auth.split(' ', 1)[1].strip() if auth.startswith('Bearer ') else None
	current_user_id = verify_access_token(token) if token else None
	
	# Allow user to view own borrowings or admin to view any
	db = get_db()
	cur = db.cursor(dictionary=True)
	
	if current_user_id != user_id:
		# Check if current user is admin
		cur.execute('SELECT is_admin FROM users WHERE id = %s', (current_user_id,))
		user = cur.fetchone()
		if not user or not user.get('is_admin'):
			return jsonify({'status': 'error', 'message': 'Forbidden'}), 403
	
	# Get borrowings with book details
	cur.execute('''SELECT b.id, b.user_id, b.book_id, b.borrowed_at, b.due_at, b.returned_at, b.status,
					bk.title, bk.author, bk.image_url
				  FROM borrowings b
				  JOIN books bk ON b.book_id = bk.id
				  WHERE b.user_id = %s
				  ORDER BY b.borrowed_at DESC''',
				(user_id,))
	borrowings = cur.fetchall()
	
	# Calculate stats
	cur.execute('''SELECT 
					COUNT(CASE WHEN status = 'borrowed' THEN 1 END) as current_borrowed,
					COUNT(CASE WHEN status = 'returned' THEN 1 END) as total_returned
				  FROM borrowings WHERE user_id = %s''',
				(user_id,))
	stats = cur.fetchone()
	
	return jsonify({
		'status': 'success',
		'data': {
			'borrowings': borrowings,
			'stats': {
				'current_borrowed': stats.get('current_borrowed', 0),
				'total_returned': stats.get('total_returned', 0),
				'total_borrowed': (stats.get('current_borrowed', 0) + stats.get('total_returned', 0))
			}
		}
	})


@app.route('/api/categories', methods=['GET'])
def get_categories():
	"""Return distinct non-empty categories from books table."""
	db = get_db()
	cur = db.cursor()
	try:
		cur.execute("SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC")
		rows = cur.fetchall()
		cats = [r[0] for r in rows if r and r[0]]
		return jsonify({'status': 'success', 'data': {'categories': cats}})
	except Exception as e:
		return jsonify({'status': 'error', 'message': str(e)}), 500

# ===== Error handlers =====
@app.errorhandler(400)
def bad_request(error):
    """400 - Bad Request"""
    if request.path.startswith('/api/'):
        return error_response("Bad request", 400, "BAD_REQUEST")
    return render_template('Error/400.html'), 400

@app.errorhandler(401)
def unauthorized(error):
    """401 - Unauthorized"""
    if request.path.startswith('/api/'):
        return error_response("Unauthorized", 401, "UNAUTHORIZED")
    return render_template('Error/401.html'), 401

@app.errorhandler(403)
def forbidden(error):
    """403 - Forbidden"""
    if request.path.startswith('/api/'):
        return error_response("Forbidden", 403, "FORBIDDEN")
    return render_template('Error/403.html'), 403

@app.errorhandler(404)
def not_found(error):
    """404 - Not Found"""
    if request.path.startswith('/api/'):
        return error_response("Resource not found", 404, "NOT_FOUND")
    return render_template('Error/404.html'), 404

@app.errorhandler(405)
def method_not_allowed(error):
    """405 - Method Not Allowed"""
    if request.path.startswith('/api/'):
        return error_response("Method not allowed", 405, "METHOD_NOT_ALLOWED")
    return render_template('Error/405.html'), 405

@app.errorhandler(408)
def request_timeout(error):
    """408 - Request Timeout"""
    if request.path.startswith('/api/'):
        return error_response("Request timeout", 408, "TIMEOUT")
    return render_template('Error/408.html'), 408

@app.errorhandler(409)
def conflict(error):
    """409 - Conflict"""
    if request.path.startswith('/api/'):
        return error_response("Resource conflict", 409, "CONFLICT")
    return render_template('Error/409.html'), 409

@app.errorhandler(413)
def payload_too_large(error):
    """413 - Payload Too Large"""
    if request.path.startswith('/api/'):
        return error_response("Payload too large", 413, "PAYLOAD_TOO_LARGE")
    return render_template('Error/413.html'), 413

@app.errorhandler(415)
def unsupported_media_type(error):
    """415 - Unsupported Media Type"""
    if request.path.startswith('/api/'):
        return error_response("Unsupported media type", 415, "UNSUPPORTED_MEDIA")
    return render_template('Error/415.html'), 415

@app.errorhandler(429)
def too_many_requests(error):
    """429 - Too Many Requests"""
    if request.path.startswith('/api/'):
        return error_response("Too many requests", 429, "RATE_LIMITED")
    return render_template('Error/429.html'), 429

@app.errorhandler(500)
def internal_error(error):
    """500 - Internal Server Error"""
    logger.exception("Internal server error")
    if request.path.startswith('/api/'):
        return error_response("Internal server error", 500, "SERVER_ERROR")
    return render_template('Error/500.html'), 500

@app.errorhandler(502)
def bad_gateway(error):
    """502 - Bad Gateway"""
    if request.path.startswith('/api/'):
        return error_response("Bad gateway", 502, "BAD_GATEWAY")
    return render_template('Error/502.html'), 502

@app.errorhandler(503)
def service_unavailable(error):
    """503 - Service Unavailable"""
    if request.path.startswith('/api/'):
        return error_response("Service unavailable", 503, "SERVICE_UNAVAILABLE")
    return render_template('Error/503.html'), 503

@app.errorhandler(504)
def gateway_timeout(error):
    """504 - Gateway Timeout"""
    if request.path.startswith('/api/'):
        return error_response("Gateway timeout", 504, "GATEWAY_TIMEOUT")
    return render_template('Error/504.html'), 504


# ===== CATCH-ALL ROUTE =====
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
	# Let Flask serve static files first
	static_folder = str(app.static_folder or 'static')
	if path and os.path.exists(os.path.join(static_folder, path)):
		return send_from_directory(static_folder, path)
	# For unknown paths, serve index.html
	return send_from_directory(static_folder, 'index.html')


if __name__ == '__main__':
	# Initialize DB (creates tables if not exist) - best effort
	with app.app_context():
		try:
			init_db()
		except Exception as e:
			print('DB init failed:', e)
	app.run(host='0.0.0.0', port=5000, debug=False)
