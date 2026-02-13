# Job Application Type Sorting Feature

## Overview
Added functionality to **separate and filter jobs by application type** (Auto-Apply vs Manual-Apply) **BEFORE** clicking any buttons. This allows users to immediately see which jobs support auto-application and which require manual application on the company website.

## Changes Made

### 1. Frontend (UI) Changes

#### `frontend/public/index.html`
- **Added new filter dropdown**: "Application Type" filter with options:
  - All Types
  - Auto Apply
  - Manual Apply (Company Site)
- This filter appears alongside Status and Platform filters in the Job Listings section

#### `frontend/public/app.js`
- **Added `filterApplyType` selector** to capture the new filter
- **Modified `refreshJobsList()` function** to:
  - Fetch the application type filter value
  - Apply client-side filtering based on `isExternalApply` flag
  - Filter jobs into "auto" or "manual" categories
- **Enhanced job row rendering** to:
  - Detect manual-apply jobs using `isExternalApply` flag or `applicationType` field
  - Show **"Apply on Site"** button immediately for manual-apply jobs (not just after auto-apply fails)
  - Show **"Auto Apply"** button for jobs that support automatic application
  - Display appropriate status badges from the start
- **Added event listener** for the new filter to trigger list refresh on change

### 2. Backend Changes

#### `backend/src/job-storage.js`
- **Modified `getJobs()` function** to add `isExternalApply` flag to each job
- The flag is set to `true` when:
  - `applicationType === "external_redirect"` (redirects to company site)
  - `applicationType === "manual_review"` (requires registration/sign-up)
- This flag is automatically added to all jobs returned by the API

#### `backend/src/scrapers/naukri-scraper.js`
- Already detects `applicationType` during scraping (lines 210-226)
- Identifies three types:
  - `"auto_apply"` - Standard Naukri application
  - `"external_redirect"` - Redirects to external company site
  - `"manual_review"` - Requires registration or sign-up

## How It Works

### Flow:
1. **Scraping**: Naukri scraper detects application type for each job
2. **Storage**: Jobs are stored with `applicationType` field
3. **API**: `getJobs()` adds `isExternalApply` flag based on `applicationType`
4. **Frontend**: 
   - Jobs are displayed with appropriate buttons from the start
   - Users can filter by application type
   - Manual-apply jobs show "Apply on Site" button immediately
   - Auto-apply jobs show "Auto Apply" button

### User Experience:
- **Before**: Users had to click "Auto Apply" to discover if a job requires manual application
- **After**: Users can immediately see and filter jobs by application type
- **Benefit**: Saves time by allowing users to focus on auto-apply jobs or manually handle company-site applications upfront

## Filter Options

### Application Type Filter Values:
- **All Types**: Shows all jobs regardless of application method
- **Auto Apply**: Shows only jobs that support automatic application through Naukri
- **Manual Apply (Company Site)**: Shows only jobs that require application on the company's website

## Button Display Logic

### For Manual-Apply Jobs:
- Status Badge: "Manual Apply" (orange)
- Action Button: "Apply on Site" (orange, opens external URL)
- Shown immediately, not after auto-apply attempt

### For Auto-Apply Jobs:
- Status Badge: "Pending" (orange) or "Applied" (green)
- Action Buttons: "Auto Apply" + "Skip"
- Standard auto-application flow

## Technical Details

### Frontend Filter Logic:
```javascript
if (applyType === "manual") {
  return isExternalApply;
} else if (applyType === "auto") {
  return !isExternalApply;
}
```

### Backend Flag Logic:
```javascript
isExternalApply: job.applicationType === "external_redirect" || 
                 job.applicationType === "manual_review"
```

## Benefits

1. **Time Savings**: No need to click auto-apply to discover manual jobs
2. **Better Organization**: Separate job listings by application method
3. **Improved UX**: Clear visual indicators from the start
4. **Efficient Workflow**: Focus on auto-apply jobs or handle manual applications separately
5. **No Wasted Attempts**: Avoid clicking auto-apply on jobs that require manual application

## Testing

To test this feature:
1. Scrape jobs from Naukri
2. Use the "Application Type" filter to separate jobs
3. Verify manual-apply jobs show "Apply on Site" button immediately
4. Verify auto-apply jobs show "Auto Apply" button
5. Click filters to ensure proper job separation
