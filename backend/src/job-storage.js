const fs = require("fs");
const path = require("path");
const { readJson, writeJsonAtomic } = require("./utils");

const JOBS_PATH = path.resolve(__dirname, "..", "..", "data", "jobs.json");
const APP_LOG_PATH = path.resolve(__dirname, "..", "..", "data", "application-log.json");

/**
 * Load all stored jobs from disk
 */
function loadJobs() {
  return readJson(JOBS_PATH, { jobs: [], lastUpdated: null });
}

/**
 * Save jobs to disk
 */
function saveJobs(data) {
  const toSave = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };
  writeJsonAtomic(JOBS_PATH, toSave);
}

/**
 * Add new jobs to storage (with deduplication)
 */
function addJobs(newJobs) {
  const data = loadJobs();
  const existing = new Map();

  // Index existing jobs by unique key
  for (const job of data.jobs || []) {
    const key = `${job.platform}-${job.jobId}`;
    existing.set(key, job);
  }

  let addedCount = 0;

  for (const job of newJobs) {
    const key = `${job.platform}-${job.jobId}`;

    if (!existing.has(key)) {
      // New job - add it
      existing.set(key, {
        ...job,
        scrapedDate: new Date().toISOString(),
        applicationStatus: "pending",
        appliedDate: null,
      });
      addedCount++;
    } else {
      // Job exists - update certain fields if needed
      const existingJob = existing.get(key);
      if (existingJob.applicationStatus === "pending") {
        // Update job details but preserve application status
        existing.set(key, {
          ...job,
          scrapedDate: existingJob.scrapedDate,
          applicationStatus: existingJob.applicationStatus,
          appliedDate: existingJob.appliedDate,
        });
      }
    }
  }

  data.jobs = Array.from(existing.values());
  saveJobs(data);

  return { total: data.jobs.length, added: addedCount };
}

/**
 * Get jobs by filter criteria
 */
function getJobs(filters = {}) {
  const data = loadJobs();
  let jobs = data.jobs || [];

  if (filters.platform) {
    jobs = jobs.filter(j => j.platform === filters.platform);
  }

  if (filters.applicationStatus) {
    jobs = jobs.filter(j => j.applicationStatus === filters.applicationStatus);
  }

  if (filters.isRemote !== undefined) {
    jobs = jobs.filter(j => j.isRemote === filters.isRemote);
  }

  if (filters.dateFrom) {
    jobs = jobs.filter(j => new Date(j.scrapedDate) >= new Date(filters.dateFrom));
  }

  if (filters.limit) {
    jobs = jobs.slice(0, filters.limit);
  }

  // Add isExternalApply flag for frontend filtering
  jobs = jobs.map(job => ({
    ...job,
    isExternalApply: job.applicationType === "external_redirect" || job.applicationType === "manual_review"
  }));

  return jobs;
}

/**
 * Update job application status
 */
function updateJobStatus(platform, jobId, status, metadata = {}) {
  const data = loadJobs();
  const key = `${platform}-${jobId}`;

  const job = data.jobs.find(j => `${j.platform}-${j.jobId}` === key);

  if (job) {
    job.applicationStatus = status;
    if (status === "applied") {
      job.appliedDate = new Date().toISOString();
    }

    // Add any additional metadata
    Object.assign(job, metadata);

    saveJobs(data);

    // Log the application
    logApplication({
      platform,
      jobId,
      jobTitle: job.title,
      company: job.company,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    });

    return true;
  }

  return false;
}

/**
 * Log application attempts
 */
function logApplication(entry) {
  const log = readJson(APP_LOG_PATH, { applications: [] });
  log.applications.push(entry);

  // Keep only last 1000 entries
  if (log.applications.length > 1000) {
    log.applications = log.applications.slice(-1000);
  }

  writeJsonAtomic(APP_LOG_PATH, log);
}

/**
 * Get application statistics
 */
function getStats() {
  const data = loadJobs();
  const jobs = data.jobs || [];

  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.applicationStatus === "pending").length,
    applied: jobs.filter(j => j.applicationStatus === "applied").length,
    failed: jobs.filter(j => j.applicationStatus === "failed").length,
    skipped: jobs.filter(j => j.applicationStatus === "skipped").length,
    byPlatform: {},
    appliedToday: 0,
    remote: jobs.filter(j => j.isRemote).length,
  };

  // Count by platform
  for (const job of jobs) {
    if (!stats.byPlatform[job.platform]) {
      stats.byPlatform[job.platform] = {
        total: 0,
        pending: 0,
        applied: 0,
      };
    }
    stats.byPlatform[job.platform].total++;
    if (job.applicationStatus === "pending") {
      stats.byPlatform[job.platform].pending++;
    }
    if (job.applicationStatus === "applied") {
      stats.byPlatform[job.platform].applied++;
    }
  }

  // Count applications today
  const today = new Date().toISOString().split("T")[0];
  stats.appliedToday = jobs.filter(j =>
    j.applicationStatus === "applied" &&
    j.appliedDate &&
    j.appliedDate.startsWith(today)
  ).length;

  return stats;
}

/**
 * Get pending jobs for a platform (respecting daily limit)
 */
function getPendingJobs(platform, dailyLimit = 30) {
  const stats = getStats();
  const appliedTodayForPlatform = getJobs({
    platform,
    applicationStatus: "applied",
  }).filter(j => {
    if (!j.appliedDate) return false;
    const today = new Date().toISOString().split("T")[0];
    return j.appliedDate.startsWith(today);
  }).length;

  const remaining = Math.max(0, dailyLimit - appliedTodayForPlatform);

  if (remaining === 0) {
    return [];
  }

  return getJobs({
    platform,
    applicationStatus: "pending",
    limit: remaining,
  });
}

/**
 * Clear all jobs from storage
 */
function clearJobs() {
  saveJobs({ jobs: [], lastUpdated: new Date().toISOString() });
  return { total: 0 };
}

module.exports = {
  loadJobs,
  saveJobs,
  addJobs,
  getJobs,
  updateJobStatus,
  getStats,
  getPendingJobs,
  logApplication,
  clearJobs,
};
