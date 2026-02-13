# QUICK FIX - Manual Login Once

## What I Fixed:
1. ✅ Fixed CSS selector error (was causing crashes)
2. ✅ Increased delay between applications: 5s → **30 seconds**
3. ✅ Bot uses persistent browser profile (remembers login)

## How to Use (ONE-TIME SETUP):

### Step 1: Restart Server
```
Ctrl+C (stop current server)
npm run ui
```

### Step 2: Start Auto-Apply
- Go to http://localhost:4545
- Click "Auto-Apply"
- A Chrome window will open

### Step 3: Login ONCE (Manual)
- In the Chrome window that opened, go to: https://www.naukri.com/nlogin/login
- Login with your credentials:
  - Email: vickyjagdale04@gmail.com
  - Password: Vicky@2001
- After login, you'll see "My Naukri" or your profile

### Step 4: Run Auto-Apply Again
- Go back to http://localhost:4545
- Click "Auto-Apply" again
- **This time it will work!**
- It will apply to jobs one by one with 30-second delays

## Why This Works:
- The bot saves your login in `browser_data/` folder
- Once you login manually ONCE, it remembers forever
- Future auto-applies will detect you're logged in automatically
- No need to login again (unless you delete `browser_data/` folder)

## What Happens During Auto-Apply:
1. Opens job page
2. Finds "Apply" button
3. Clicks Apply
4. Handles chatbot questions (if any)
5. Waits 8 seconds to confirm success
6. Waits 30 seconds before next job
7. Repeats for all pending jobs

## Expected Time:
- 9 pending jobs × 30 seconds = ~4.5 minutes minimum
- Plus time for each application (chatbot, forms) = ~10-15 minutes total
