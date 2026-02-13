const config = require("./config");
const { startScheduler } = require("./scheduler");
const { startWatcher } = require("./watcher");
const { sendPending } = require("./send");

async function main() {
  console.log("Job Mailer starting...");
  console.log("Env loaded from:", config.meta?.loadedEnvFile || "(unknown)");
  console.log("Recipients CSV:", config.paths.recipientsCsv);
  console.log("Sent log:", config.paths.sentJson);
  console.log("Resume path:", config.paths.resumePath);
  console.log("Schedule:", config.schedule.cron, `(${config.schedule.timezone})`);
  console.log("DRY_RUN:", config.behavior.dryRun);

  // Start watcher so adding a new email triggers an immediate send.
  await startWatcher();

  // Start scheduled bulk send (only sends recipients not yet in sent.json).
  startScheduler({
    onTick: async () => {
      await sendPending({ source: "cron" });
    },
  });

  console.log("Job Mailer is running. (Ctrl+C to stop)");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


