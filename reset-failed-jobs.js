const fs = require('fs');
const path = require('path');

// Load jobs.json
const jobsPath = path.join(__dirname, 'data', 'jobs.json');
const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

console.log('Before reset:');
console.log('- Pending jobs:', jobsData.jobs.filter(j => j.applicationStatus === 'pending').length);
console.log('- Failed jobs:', jobsData.jobs.filter(j => j.applicationStatus === 'failed').length);

// Reset ALL failed jobs to pending
let resetCount = 0;
jobsData.jobs.forEach(job => {
    if (job.applicationStatus === 'failed') {
        job.applicationStatus = 'pending';
        job.failureReason = null;
        job.appliedDate = null;
        resetCount++;
    }
});

// Save updated jobs
fs.writeFileSync(jobsPath, JSON.stringify(jobsData, null, 2));

console.log('\nAfter reset:');
console.log('- Pending jobs:', jobsData.jobs.filter(j => j.applicationStatus === 'pending').length);
console.log('- Failed jobs:', jobsData.jobs.filter(j => j.applicationStatus === 'failed').length);
console.log(`\nReset ${resetCount} jobs from failed to pending`);
console.log('\nNow you can try auto-apply again!');
