const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/contact/visitors');
    const data = await res.json();
    const filePath = path.resolve(__dirname, '../src/pages/Admin/mockAdminData.js');
    let content = fs.readFileSync(filePath, 'utf8');

    // Update initialStats visitorsCount
    content = content.replace(/visitorsCount:\s*\d+,/, `visitorsCount: ${data.total},`);
    content = content.replace(/visitorsTrend:\s*"[^"]*",/, `visitorsTrend: "${data.total} real user sessions",`);
    content = content.replace(/\{\s*name:\s*"Visitors",\s*count:\s*\d+\s*\}/, `{ name: "Visitors", count: ${data.total} }`);
    content = content.replace(/\{\s*name:\s*"Visitors",\s*value:\s*\d+,\s*percent:\s*"[^"]*",\s*color:\s*"#2563eb"\s*\}/, `{ name: "Visitors", value: ${data.total}, percent: "79%", color: "#2563eb" }`);

    // Replace initialVisitors array
    const visitorsSlice = data.visitors.slice(0, 100);
    const visitorsStr = 'export const initialVisitors = ' + JSON.stringify(visitorsSlice, null, 2) + ';';
    content = content.replace(/export const initialVisitors = \[[\s\S]*?\n\];/, visitorsStr);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Successfully updated mockAdminData.js with ${data.total} visitors and live records!`);
  } catch (err) {
    console.error('Error updating mockAdminData:', err);
  }
})();
