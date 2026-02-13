try {
    const mammoth = require("mammoth");
    console.log("Mammoth loaded OK");
} catch (e) {
    console.error("Mammoth failed to load:", e.message);
}

try {
    const pdfParse = require("pdf-parse");
    console.log("pdf-parse loaded OK");
} catch (e) {
    console.error("pdf-parse failed to load:", e.message);
}
