# Email History – Full-Stack App

Minimal full-stack app: **signup**, **login** (with region), **Excel (.xlsx) upload**, **dashboard** (table filtered by region), and **record detail** with Last Visit Date.  
Backend: Node.js + Express + Supabase (Postgres). Frontend: HTML, CSS, vanilla JavaScript.  
Auth: JWT. Passwords hashed with bcrypt. Records stored permanently and filtered by the region selected at login.

## Project structure

```
emailhistory/
├── backend/
│   ├── config/       # DB connection, regions list
│   ├── middleware/   # auth (JWT), upload (multer)
│   ├── models/       # User, Record
│   ├── routes/       # auth, records, upload
│   ├── scripts/      # seed-user.js
│   ├── uploads/      # temp uploads (auto-created)
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── css/style.css
│   ├── js/auth.js
│   ├── index.html    # redirects to login or dashboard
│   ├── login.html    # email, password, region (dropdown with search)
│   ├── signup.html
│   ├── upload.html
│   ├── dashboard.html   # table without ID column, filtered by region
│   └── record.html   # detail + Last Visit Date with date input
└── README.md
```

## Setup

1. **Supabase**
   - Create a Supabase project.
   - In SQL Editor, run the schema script in `backend/supabase/schema.sql`.
   - Copy your project URL and service role key.

2. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, optional PORT/MAX_FILE_SIZE_MB
   npm install
   node scripts/seed-user.js   # creates admin@example.com / admin123
   npm start
   ```
   Server runs at `http://localhost:3000`.

3. **Frontend**  
   Served by the same server. Open `http://localhost:3000`:
   - **Sign up:** Create account from signup page (link on login).
   - **Login:** Email, password, and **region** (type to search; "All" shows every record). Region filters the dashboard.
   - **Upload:** Upload .xlsx → rows stored permanently; region auto-detected from cell values where possible.
   - **Dashboard:** Table of records for the selected region (no ID column); click a row for detail.
   - **Detail:** All fields plus **Last Visit Date** with a date box; changing it saves via API.

## API (REST)

- `POST /api/auth/login` – body: `{ "email", "password" }` → `{ "token", "user" }`
- `POST /api/upload` – multipart file (field: `file`), Bearer token required → parses .xlsx, stores rows in `records`
- `GET /api/records` – Bearer token required → list of records
- `GET /api/records/:id` – Bearer token required → single record

## Security and checks

- Only authenticated users can use upload, dashboard, and record detail.
- Passwords hashed with bcrypt; JWT for sessions.
- Excel: only `.xlsx` accepted; file size limit (default 5MB via `MAX_FILE_SIZE_MB`).
- Invalid/empty Excel and duplicate rows handled; basic error handling on all APIs.

## Database (Supabase/Postgres)

- **users** – email, hashed password.
- **records** – one row per Excel row; dynamic fields in JSONB `data`; `uploaded_by`, `source_file`, `row_index`, `region`.
- **communications** – one row per `record_id + visit_date` for saved communication forms.
