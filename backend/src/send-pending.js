const { sendPending } = require("./send");

async function main() {
  await sendPending({ source: "manual" });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


