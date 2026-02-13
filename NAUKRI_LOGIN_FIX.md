# Quick Fix for Naukri Auto-Apply

## The Problem
- Naukri changed their login page structure
- Automated login is failing
- 0/2 jobs applied because bot can't login

## The Solution (Manual Login Workaround)

### Step 1: Start Auto-Apply
1. Go to http://localhost:4545
2. Click "Auto-Apply" on the pending jobs

### Step 2: When Browser Opens
- A Chrome window will open automatically
- You'll see it trying to login and failing
- **DON'T CLOSE THE BROWSER**

### Step 3: Manual Login
1. In that same browser window, go to: https://www.naukri.com/nlogin/login
2. Login manually with your credentials:
   - Email: vickyjagdale04@gmail.com
   - Password: Vicky@2001
3. After successful login, you'll see "My Naukri" or your profile

### Step 4: Try Auto-Apply Again
1. Go back to http://localhost:4545
2. Click "Auto-Apply" again
3. **This time it will detect you're logged in** and apply to jobs!

## Why This Works
- The browser keeps your login session (cookies)
- Next time you run auto-apply, it checks if you're logged in
- Sees you are, skips login, goes straight to applying

## Permanent Fix (Coming Soon)
I'm working on fixing the automated login to handle Naukri's new two-step login process.

## Alternative: Reset Failed Jobs
If you want to retry the failed jobs:
1. Go to the Jobs tab
2. Find jobs with "Failed" status
3. They should have a "Retry" or "Reset" button
