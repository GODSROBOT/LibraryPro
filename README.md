LibraryPro — Flask backend for the provided frontend

What I added
- `app.py` — Flask app with API routes that match the frontend JS (`/api/*`).
- `db.py` — MySQL connection pool helper using `mysql-connector-python` and an `init_db()` helper that runs `schema.sql`.
- `schema.sql` — Basic schema to create `users`, `refresh_tokens`, and `books` tables.
- `requirements.txt` — Python dependencies.

Quick setup (Windows PowerShell)

1. Create a virtual environment and activate it:

   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

2. Install dependencies:

   pip install -r requirements.txt

3. Create a MySQL database and user (example):

   # using MySQL CLI or Workbench
   CREATE DATABASE librarydb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'library'@'localhost' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON librarydb.* TO 'library'@'localhost';

4. Set environment variables in PowerShell (or use your system environment):

   $env:MYSQL_HOST = '127.0.0.1'
   $env:MYSQL_PORT = '3306'
   $env:MYSQL_USER = 'library'
   $env:MYSQL_PASSWORD = 'password'
   $env:MYSQL_DATABASE = 'librarydb'
   $env:LIBRARY_SECRET = 'replace-with-a-secure-secret'

5. Initialize DB and run the app:

   # Running the app will attempt to run schema.sql automatically
   python app.py

6. Import books from the provided `books.json` into the database:

   python scripts/import_books.py


What works now
- User register/login (returns access_token & refresh_token)
- Token refresh, bootstrap session (sets cookie), logout
- Books list, create, update, delete
- Users listing and basic profile endpoints

Notes & next steps
- The code uses JWT for access tokens and stores refresh tokens in the DB.
- The DB init is best-effort; in production run `schema.sql` via your preferred DB tooling.
- Improve security: use HTTPS, stronger token handling, expiry/cleanup for refresh tokens, and rate-limiting.
- Add tests and more detailed validations as needed.
