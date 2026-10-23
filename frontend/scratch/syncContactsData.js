const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const res = await fetch('http://localhost:5000/api/contact?pageSize=500');
    const data = await res.json();
    const filePath = path.resolve(__dirname, '../src/pages/Admin/mockAdminData.js');
    let content = fs.readFileSync(filePath, 'utf8');

    // Update initialStats contactsCount
    content = content.replace(/contactsCount:\s*\d+,/, `contactsCount: ${data.total},`);
    content = content.replace(/contactsTrend:\s*"[^"]*",/, `contactsTrend: "${data.total} verified inquiries",`);
    content = content.replace(/\{\s*name:\s*"Contacts",\s*count:\s*\d+\s*\}/, `{ name: "Contacts", count: ${data.total} }`);
    content = content.replace(/\{\s*name:\s*"Contacts",\s*value:\s*\d+,\s*percent:\s*"[^"]*",\s*color:\s*"#7c3aed"\s*\}/, `{ name: "Contacts", value: ${data.total}, percent: "3%", color: "#7c3aed" }`);

    const formattedContacts = data.contacts.map((c, i) => ({
      id: i + 1,
      fullName: c.name || "User",
      email: c.email || "",
      organization: c.organization || (c.subject && c.subject.toLowerCase().includes("partner") ? "Edutechex Global" : "Edutechex India"),
      country: "India",
      areaOfInterest: c.subject || "General Inquiry",
      projectStage: "General Inquiry",
      phone: c.phone || "+91 93981 33808",
      message: c.message || "",
      date: c.createdAt ? c.createdAt.slice(0, 10) : "2026-10-19"
    }));

    const contactsStr = 'export const initialContacts = ' + JSON.stringify(formattedContacts, null, 2) + ';';
    content = content.replace(/export const initialContacts = \[[\s\S]*?\n\];/, contactsStr);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Successfully updated mockAdminData.js with ${data.total} contacts!`);
  } catch (err) {
    console.error('Error updating contacts in mockAdminData:', err);
  }
})();
