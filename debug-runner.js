const fs = require('fs');

function logError(err) {
    const msg = `ERROR:\n${err.stack || err}\n`;
    console.error(msg);
    fs.writeFileSync('debug-error.txt', msg, 'utf8');
}

process.on('uncaughtException', (err) => {
    logError(err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
    logError(reason);
    process.exit(1);
});

try {
    console.log("Starting ui-server...");
    require('./backend/src/ui-server');
} catch (err) {
    logError(err);
    process.exit(1);
}
