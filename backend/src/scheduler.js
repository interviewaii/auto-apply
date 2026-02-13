const cron = require("node-cron");
const config = require("./config");

function startScheduler({ onTick }) {
  const { cron: cronExpr, timezone } = config.schedule;

  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid SCHEDULE_CRON: "${cronExpr}"`);
  }

  const task = cron.schedule(
    cronExpr,
    async () => {
      console.log(`[cron] Triggered at ${new Date().toISOString()}`);
      await onTick();
    },
    { timezone },
  );

  task.start();
  console.log(`[cron] Scheduled "${cronExpr}" (${timezone})`);
  return task;
}

module.exports = { startScheduler };


