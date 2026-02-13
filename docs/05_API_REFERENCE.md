## Job Mailer — API Reference (Necessary Doc)

Base URL: the UI server host/port (default `http://localhost:4545`).

> Note: If UI auth is enabled, you must login first so the cookie session is present.

---

### Auth
#### POST `/api/login`
Body (JSON):
- `user`: string
- `pass`: string

Response:
- `{ ok: true, authEnabled: true }` or error.

#### POST `/api/logout`
No body.

---

### Settings
#### GET `/api/settings`
Returns saved settings metadata and safe fields (password not returned).

#### POST `/api/settings`
Body (JSON):
- `smtpHost`, `smtpPort`, `smtpSecure`
- `smtpUser`, `smtpPass` (optional; blank keeps existing)
- `fromEmail`, `fromName`
- `subject`, `defaultBody`

#### POST `/api/settings/resume`
Multipart:
- `resume`: PDF file

---

### Sending
#### POST `/api/send`
Multipart:
- `email` (required)
- `name` (optional)
- `subject` (optional)
- `body` (optional)
- `resume` (optional PDF)

Response:
- `{ ok: true, toEmail, subject, messageId, usedDefaults: { subject, body, resume } }`

#### POST `/api/send-bulk`
Multipart:
- `excel` (required .xlsx)
- `resume` (optional PDF for all rows)

Response:
- `{ ok: true, total, sent, failed, results: [...] }`

#### POST `/api/send-list`
Multipart:
- `emails` (required: comma/newline separated string)
- `resume` (optional)

---

### Downloads
#### GET `/api/template.xlsx`
Downloads a template Excel.

#### GET `/api/sent.xlsx`
Downloads the current sent log Excel.

---

### HR Finder
#### GET `/api/provider-status`
Returns which HR providers are configured (no secrets).

#### GET `/api/company-names`
Returns saved company names (for dropdown).

#### GET `/api/company-suggest?query=...`
Returns live company name suggestions (Clearbit).

#### GET `/api/hr-lookup`
Query params:
- `company` (optional)
- `domain` (optional but recommended)
- `provider` (`hunter` or `apollo`)

Response:
- `{ ok: true, domain, contacts: [...] }`

---

### ATS
#### POST `/api/ats-score`
Multipart:
- `jd` (required)
- `resume` (optional file) OR `resumeText` (optional text)

#### POST `/api/ats-optimize`
Same input, returns suggestions + makes `/api/ats-optimized.pdf` available.

#### GET `/api/ats-optimized.pdf`
Downloads the last generated PDF.

