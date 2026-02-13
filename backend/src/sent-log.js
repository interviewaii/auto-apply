const { readJson, writeJsonAtomic } = require("./utils");

function loadSentLog(sentJsonPath) {
  return readJson(sentJsonPath, {});
}

function isSent(sentLog, email) {
  return sentLog[email]?.status === "sent";
}

function upsertLog(sentJsonPath, email, details) {
  const sentLog = loadSentLog(sentJsonPath);
  sentLog[email] = { ...(sentLog[email] || {}), ...details };
  writeJsonAtomic(sentJsonPath, sentLog);
}

function markSent(sentJsonPath, email, details) {
  upsertLog(sentJsonPath, email, {
    status: "sent",
    sentAt: new Date().toISOString(),
    ...details,
  });
}

function markError(sentJsonPath, email, details) {
  upsertLog(sentJsonPath, email, {
    status: "error",
    errorAt: new Date().toISOString(),
    ...details,
  });
}

module.exports = { loadSentLog, isSent, markSent, markError };


