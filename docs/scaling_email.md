# Scaling Job Mailer

## 1. High-Volume SMTP Providers (Better than Gmail)
Gmail allows ~500 emails per day. For higher volumes or "unlimited" sending, you need a dedicated SMTP provider. These services provide better deliverability and higher limits.

### Recommended Providers:
1.  **Amazon SES (Simple Email Service)** - *Most Cost Effective*
    *   **Cost:** extremely cheap ($0.10 for 1,000 emails).
    *   **Pros:** High deliverability, scales to millions/day.
    *   **Cons:** Harder to set up (requires domain verification & AWS account).

2.  **SendGrid / Mailgun**
    *   **Cost:** Free tier (~100/day), then ~$15-35/month for ~50k emails.
    *   **Pros:** Easy setup, good dashboard.
    *   **Cons:** Expensive at scale compared to SES.

3.  **Brevo (formerly Sendinblue)**
    *   **Cost:** Free tier (300/day).
    *   **Pros:** Good free plan.

### How to use them:
You get SMTP credentials (Host, User, Password) from their dashboard and update your `.env` file:
```ini
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASS=...
```

---

## 2. Multi-User Support Strategy

Currently, this project is designed for a **single user** on a local machine (1 config file, 1 database file).

### Method A: Run Multiple Copies (Easiest)
If you just have a small team (e.g., 3 people):
1.  Copy the entire `JobReach-main` folder for each person.
    *   `Manager_Folder/` -> Has its own `.env` and `data/`
    *   `Recruiter_Folder/` -> Has its own `.env` and `data/`
2.  Each person runs `npm run ui` in their own folder.
3.  Each person uses a **different** SMTP account (or the same one with different "From" addresses).

### Method B: Code Refactor (Advanced Dev Work)
To make this a true SaaS platform for multiple users, major code changes are needed:
1.  **Database:** Replace `data/sent.json` with a real database (SQLite/PostgreSQL) labeled by `user_id`.
2.  **Auth:** Implement a login system where users register accounts.
3.  **Config:** Move `.env` settings into the database (so each user saves their own SMTP credentials in the UI).

**Recommendation:** Start with Method A. It requires zero code changes.

### Method C: Use One Folder, Switch Accounts Daily (Easiest for 1 Person)
If **you** alone want to send 1,000 emails/day using 2 Gmail accounts:
1.  Run the app as usual.
2.  Send your first 500 emails with Account A.
3.  Go to the **Settings** tab in the UI.
4.  Change **SMTP user / email** to `account_B@gmail.com`.
5.  Change **SMTP app password** to Account B's App Password.
6.  Click **Save defaults**.
7.  Continue sending (the app now uses Account B instantly).
