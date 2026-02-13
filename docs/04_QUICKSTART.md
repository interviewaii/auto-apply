## Job Mailer — Quickstart (Necessary Doc)

### Prerequisites
- Node.js installed
- A working SMTP account (Gmail App Password recommended)

### Install
```bash
npm install
```

### Configure
Create `.env` in project root (copy from `env.example`) and set your values.

Minimum required for sending:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `FROM_EMAIL` (or it will default to `SMTP_USER`)
- `RESUME_PATH`

Optional but recommended:
- `UI_AUTH_USER`, `UI_AUTH_PASS` (protect the UI)

### Run modes
- UI mode:
```bash
npm run ui
```
Open the printed URL (typically `http://localhost:4545`).

- Automation mode (watcher + cron):
```bash
npm run start
```

- One-shot send (send all pending from CSV):
```bash
npm run send:now
```

- Watch-only mode:
```bash
npm run watch
```

### Automation input file
Create `data/recipients.csv` with either format:

Header format:
- `email,name`

Or headerless:
- `someone@company.com,Recruiter Name`

### Where logs are stored
- `data/sent.json` → idempotency + status
- `data/sent.xlsx` → excel report

### Troubleshooting
- If SMTP fails on port 587 due to network restrictions, try:
  - `SMTP_PORT=465`
  - `SMTP_SECURE=true`
- If HR Finder returns nothing, provide the company domain directly for best accuracy.

