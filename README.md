## Job Mailer (Scheduled + Auto-send on New Recipient)

This tool sends your job application email (with your resume attached) to a list of recipients:

- **Scheduled send**: sends to all recipients that haven't been emailed yet at a given time (cron)
- **Auto-send**: when you add a new email to `data/recipients.csv`, it sends automatically (and won’t re-send to old ones)

Project layout:

- **Backend**: `backend/src/` (Express API + SMTP sender + scheduler/watcher)
- **Frontend**: `frontend/public/` (static UI)

### 1) Prerequisites

- Node.js 18+ (recommended)
- An SMTP account (Gmail works with an **App Password**)

### 2) Setup

From `job-mailer/`:

1. Install deps:

```bash
npm install
```

2. Create your `.env` locally:

```bash
cp env.example .env
```

If you **don't** create `.env`, the app will fall back to loading `env.example`.

3. Put your resume PDF here:

- `job-mailer/assets/Shubham_Pawar_3Yr.pdf`

4. Add recipients to:

- `job-mailer/data/recipients.csv`

Format:
- `email,name`
- `name` is optional. If missing, it will use **Hiring Team**.

### 3) Run

- **Start scheduler + watcher (recommended)**:

```bash
npm start
```

- **Start the Web UI** (Email required, Subject/Body/Resume optional):

```bash
npm run ui
```

Then open `http://localhost:4545`.

### UI Login (optional)

Set these in `.env` (or `env.example`):

- `UI_AUTH_USER`
- `UI_AUTH_PASS`

If set, the UI will show a login page at `/login` and protect all UI + API routes.

### Bulk send from Excel (UI)

In the UI you can:
- **Download template**: `Download Excel template`
- Fill columns: **email**, **recipient name**, **subject**, **body**
- Upload the `.xlsx` and click **Send Bulk Emails**

Rules:
- **email** is required per row
- If **subject** is empty → default subject is used
- If **body** is empty → default application template is used

- **Send all pending right now**:

```bash
npm run send:now
```

- **Only watch file and auto-send on new recipients**:

```bash
npm run watch
```

### 4) Notes (important)

- This stores a local send log in `data/sent.json` to avoid duplicate emails.
- Keep reasonable delays (`DELAY_MS_BETWEEN_EMAILS`) to avoid rate-limits/spam flags.
- Use this responsibly and only for emails you’re allowed to contact.

### 5) UI behavior (per your requirement)

- **Email is mandatory**.
- If you enter **Subject/Body/Resume**, that email is sent using your **overrides**.
- If you only enter **Email** and click send, it uses your **default** Subject/Body/Resume from config/template.




### HR Finder (UI)

- Open the **HR Finder** tab
- Enter **company domain** (recommended) or company name (domain auto-detect when possible)
- Requires server env:
  - `HUNTER_API_KEY` (required)
Note: This feature is intended for discovering **public recruiting contacts** (HR/Talent Acquisition). Avoid collecting or sharing private/personal phone numbers.


