const fs = require('fs');
try {
    const content = fs.readFileSync('temp_nifty500.csv', 'utf8');
    const symbols = content.split('\n')
        .slice(1) // skip header
        .map(line => {
            const parts = line.split(',');
            return parts.length > 2 ? parts[2] : null;
        })
        .filter(s => s && s.trim().length > 0)
        .map(s => `"${s.trim()}.NS"`);

    // De-duplicate
    const unique = [...new Set(symbols)];

    const output = `export const NIFTY_500_SYMBOLS = [\n    ${unique.join(',\n    ')}\n];`;
    fs.writeFileSync('lib/nifty500.ts', output);
    console.log("Written to lib/nifty500.ts");
} catch (e) {
    console.error(e);
}
