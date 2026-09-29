const fs = require('fs');
const files = [
  'C:/Users/dell/Desktop/edutechex-fullstack/frontend/src/WebApp/Flows/UserFlow/SignUpLogin/UserCreateAccount.js',
  'C:/Users/dell/Desktop/edutechex-fullstack/frontend/src/WebApp/Flows/UserFlow/MainPage/Profile.js',
  'C:/Users/dell/Desktop/edutechex-fullstack/frontend/src/WebApp/Flows/SchoolAdminFlow/SignUpLogin/SchoolAdminProfileForm.js',
  'C:/Users/dell/Desktop/edutechex-fullstack/frontend/src/WebApp/Flows/PartnerFlow/MainPage/InstructorManagementedit.js',
  'C:/Users/dell/Desktop/edutechex-fullstack/frontend/src/WebApp/Flows/PartnerFlow/MainPage/InstructureManagement.js'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/<option value="United States">United States<\/option>\s*<option value="Canada">Canada<\/option>/g, '<option value="India">India</option>');
  content = content.replace(/<option>United States<\/option>\s*<option>Canada<\/option>/g, '<option>India</option>');
  content = content.replace(/"United States"/g, '"India"');
  content = content.replace(/"Canada"/g, '"India"');
  content = content.replace(/US_STATES/g, 'IN_STATES');
  content = content.replace(/CA_PROVINCES/g, 'IN_STATES');
  content = content.replace(/\{?\s*IN_STATES,\s*IN_STATES\s*\}?/g, '{ IN_STATES }');
  
  // Deduplicate India options just in case
  content = content.replace(/<option value="India">India<\/option>\s*<option value="India">India<\/option>/g, '<option value="India">India</option>');
  content = content.replace(/<option>India<\/option>\s*<option>India<\/option>/g, '<option>India</option>');
  
  fs.writeFileSync(f, content, 'utf8');
  console.log('Updated', f);
});
