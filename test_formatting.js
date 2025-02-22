const fs = require("fs"); const content = fs.readFileSync("test_note.md", "utf8"); function detectFormatting(content) { const lines = content.split("
"); const headings = {}; lines.forEach(line => { const headingMatch = line.match(/^(#{1,6})\s+(.+)$/); if (headingMatch) { const level = headingMatch[1].length; const text = headingMatch[2].trim(); headings[text] = level; } }); return { headings, cleanContent: content }; } const result = detectFormatting(content); console.log("Detected Formatting:", JSON.stringify(result.headings, null, 2)); console.log("
Formatted Content:", `format:${JSON.stringify(result.headings)}
${result.cleanContent}`);
