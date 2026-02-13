const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'appliers', 'naukri-applier.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = 'const applyButtonSelectors = [';
const insertIdx = content.indexOf(targetStr);

if (insertIdx === -1) {
    console.error('Could not find applyButtonSelectors definition');
    // Try searching for a simpler string if failed
    // console.log(content);
    process.exit(1);
}

// Find the comment above it if exists
const commentStr = '// Find and click the Apply button with comprehensive selectors';
const commentIdx = content.lastIndexOf(commentStr, insertIdx);

let replaceIdx = insertIdx;
if (commentIdx !== -1 && commentIdx > insertIdx - 200) { // Should be close
    replaceIdx = commentIdx;
}

const newBlock = `            // Check for external redirect (Apply on company site)
            const isExternal = await this.page.evaluate(() => {
                 const buttons = Array.from(document.querySelectorAll('button, a'));
                 return buttons.some(btn => 
                     (btn.textContent && (
                         btn.textContent.toLowerCase().includes('apply on company site') ||
                         btn.textContent.toLowerCase().includes('company website')
                     ))
                 );
            });

            if (isExternal) {
                 console.log("[Naukri] Job requires application on company site (External Redirect). Skipping.");
                 return { success: false, reason: "external_redirect" };
            }

            `;

const newContent = content.substring(0, replaceIdx) + newBlock + content.substring(replaceIdx);

fs.writeFileSync(filePath, newContent);
console.log('Successfully added external redirect check.');
