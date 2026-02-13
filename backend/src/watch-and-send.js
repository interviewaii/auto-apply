const { startWatcher } = require("./watcher");

async function main() {
  await startWatcher();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


