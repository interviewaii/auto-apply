const Job = require("./models/Job");

// --- Core Job Functions ---

async function loadJobs(userId) {
  if (!userId) throw new Error("userId required for loadJobs");
  const jobs = await Job.find({ userId });
  return { jobs, lastUpdated: new Date() };
}

async function addJobs(userId, newJobs) {
  if (!userId) throw new Error("userId required for addJobs");

  let addedCount = 0;
  for (const job of newJobs) {
    const exists = await Job.exists({ userId, platform: job.platform, jobId: job.jobId });
    if (!exists) {
      const newJ = new Job({
        userId,
        platform: job.platform,
        jobId: job.jobId,
        title: job.title,
        company: job.company,
        location: job.location,
        datePosted: job.datePosted,
        url: job.url,
        description: job.description,
        isRemote: job.isRemote,
        applicationStatus: "pending",
        scrapedDate: new Date(),
        applicationType: job.applicationType
      });
      await newJ.save();
      addedCount++;
    } else {
      // Optional: Update details if needed
    }
  }
  return { total: await Job.countDocuments({ userId }), added: addedCount };
}

async function getJobs(userId, filters = {}) {
  if (!userId) throw new Error("userId required for getJobs");

  const query = { userId };

  if (filters.platform) query.platform = filters.platform;
  if (filters.applicationStatus) query.applicationStatus = filters.applicationStatus;
  if (filters.isRemote !== undefined) query.isRemote = filters.isRemote;
  // dateFrom filter might need Moment or custom logic if string date
  if (filters.dateFrom) query.scrapedDate = { $gte: new Date(filters.dateFrom) };

  let q = Job.find(query);

  // Sort by scrapedDate desc by default
  q = q.sort({ scrapedDate: -1 });

  if (filters.limit) {
    q = q.limit(filters.limit);
  }

  const jobs = await q.exec();

  // Add computed flags for frontend
  return jobs.map(j => {
    const job = j.toObject();
    job.isExternalApply = job.applicationType === "external_redirect" || job.applicationType === "manual_review";
    return job;
  });
}

// Replaces saveJobs (no-op in DB world as we save individually)
async function saveJobs(userId, data) {
  // No-op
}

async function updateJobStatus(userId, platform, jobId, status, metadata = {}) {
  if (!userId) throw new Error("userId required for updateJobStatus");

  const query = { userId, platform, jobId };
  const update = { applicationStatus: status, ...metadata };

  if (status === "applied") {
    update.appliedDate = new Date();
  }

  const res = await Job.updateOne(query, update);

  // Also log to ApplicationLog if needed (not implemented here yet, but status flows to DB)

  return res.modifiedCount > 0;
}

async function getStats(userId) {
  if (!userId) throw new Error("userId required for getStats");

  const total = await Job.countDocuments({ userId });
  const pending = await Job.countDocuments({ userId, applicationStatus: "pending" });
  const applied = await Job.countDocuments({ userId, applicationStatus: "applied" });
  const failed = await Job.countDocuments({ userId, applicationStatus: "failed" });
  const skipped = await Job.countDocuments({ userId, applicationStatus: "skipped" });
  const remote = await Job.countDocuments({ userId, isRemote: true });

  // Platform stats
  const platforms = await Job.aggregate([
    { $match: { userId } }, // Filter by User
    {
      $group: {
        _id: "$platform",
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ["$applicationStatus", "pending"] }, 1, 0] } },
        applied: { $sum: { $cond: [{ $eq: ["$applicationStatus", "applied"] }, 1, 0] } }
      }
    }
  ]);

  const byPlatform = {};
  platforms.forEach(p => {
    byPlatform[p._id] = { total: p.total, pending: p.pending, applied: p.applied };
  });

  // Applied Today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const appliedToday = await Job.countDocuments({
    userId,
    applicationStatus: "applied",
    appliedDate: { $gte: startOfDay }
  });

  return { total, pending, applied, failed, skipped, remote, appliedToday, byPlatform };
}

async function getPendingJobs(userId, platform, dailyLimit = 30) {
  if (!userId) throw new Error("userId required for getPendingJobs");

  // Check applied today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const appliedToday = await Job.countDocuments({
    userId,
    platform,
    applicationStatus: "applied",
    appliedDate: { $gte: startOfDay }
  });

  const remaining = Math.max(0, dailyLimit - appliedToday);
  if (remaining === 0) return [];

  return getJobs(userId, {
    platform,
    applicationStatus: "pending",
    limit: remaining
  });
}

async function clearJobs(userId) {
  if (!userId) throw new Error("userId required for clearJobs");
  const res = await Job.deleteMany({ userId });
  return { total: res.deletedCount };
}

// Log is handled by job status update or separate service now
function logApplication(entry) { }

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
