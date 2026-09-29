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
  content = content.replace(/<option value="India">Canada<\/option>/g, '<option value="India">India</option>');
  content = content.replace(/<option value="USA">USA<\/option>/g, '');
  
  content = content.replace(/School Profile Details \(India\)/g, 'School Profile Details (India)');
  
  fs.writeFileSync(f, content, 'utf8');
  console.log('Cleaned', f);
});
