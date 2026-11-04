const fs = require('fs');
const path = require('path');

// 1. domain.js
const domainPath = path.resolve('frontend/src/utils/domain.js');
let domainContent = fs.readFileSync(domainPath, 'utf8');

const domainAddition = `
export const MAIN_DOMAIN =
  process.env.REACT_APP_MAIN_DOMAIN || "edutechexskills.com";

/**
 * Redirects the student to the login page after logout.
 * On local dev (localhost/127.0.0.1), uses client navigation to /user/login.
 * On live/production (such as revamp.edutechexskills.com or edutechexskills.com),
 * always redirects to the main domain: https://edutechexskills.com/user/login.
 */
export const redirectToLoginAfterLogout = (navigate) => {
  if (typeof window === "undefined") return;
  const currentHost = window.location.hostname.toLowerCase();

  if (currentHost === "localhost" || currentHost === "127.0.0.1") {
    if (typeof navigate === "function") {
      navigate("/user/login");
    } else {
      window.location.href = "/user/login";
    }
    return;
  }

  const protocol = window.location.protocol || "https:";
  window.location.href = \`\${protocol}//\${MAIN_DOMAIN}/user/login\`;
};
`;

if (!domainContent.includes('redirectToLoginAfterLogout')) {
  domainContent += domainAddition;
  fs.writeFileSync(domainPath, domainContent, 'utf8');
  console.log('Updated domain.js');
}

// 2. Sidebar.js
const sidebarPath = path.resolve('frontend/src/WebApp/Flows/UserFlow/MainPage/Sidebar.js');
let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

if (!sidebarContent.includes('redirectToLoginAfterLogout')) {
  sidebarContent = sidebarContent.replace(
    'import { isB2BContext } from "../../../../utils/domain";',
    'import { isB2BContext, redirectToLoginAfterLogout } from "../../../../utils/domain";'
  );
  sidebarContent = sidebarContent.replace(
    'navigate(isB2B ? "/user/login" : "/user");',
    'redirectToLoginAfterLogout(navigate);'
  );
  fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
  console.log('Updated Sidebar.js');
}

// 3. Navbar.js
const navbarPath = path.resolve('frontend/src/WebApp/Flows/UserFlow/MainPage/Navbar.js');
let navbarContent = fs.readFileSync(navbarPath, 'utf8');

if (!navbarContent.includes('redirectToLoginAfterLogout')) {
  navbarContent = navbarContent.replace(
    'import { isB2BContext } from "../../../../utils/domain";',
    'import { isB2BContext, redirectToLoginAfterLogout } from "../../../../utils/domain";'
  );
  navbarContent = navbarContent.replace(
    'const isB2B = isB2BContext();\n    navigate(isB2B ? "/user/login" : "/user");',
    'redirectToLoginAfterLogout(navigate);'
  );
  // Also try with \r\n
  navbarContent = navbarContent.replace(
    'const isB2B = isB2BContext();\r\n    navigate(isB2B ? "/user/login" : "/user");',
    'redirectToLoginAfterLogout(navigate);'
  );
  fs.writeFileSync(navbarPath, navbarContent, 'utf8');
  console.log('Updated Navbar.js');
}

// 4. UserMainPage.js
const userMainPath = path.resolve('frontend/src/WebApp/Flows/UserFlow/MainPage/UserMainPage.js');
let userMainContent = fs.readFileSync(userMainPath, 'utf8');

if (!userMainContent.includes('redirectToLoginAfterLogout')) {
  userMainContent = userMainContent.replace(
    'import PendingApprovalCard from \'./PendingApprovalCard\';',
    'import PendingApprovalCard from \'./PendingApprovalCard\';\nimport { redirectToLoginAfterLogout } from "../../../../utils/domain";'
  );
  userMainContent = userMainContent.replace(
    'navigate("/user/login");\n            return;',
    'redirectToLoginAfterLogout(navigate);\n            return;'
  );
  userMainContent = userMainContent.replace(
    'navigate("/user/login");\r\n            return;',
    'redirectToLoginAfterLogout(navigate);\r\n            return;'
  );
  userMainContent = userMainContent.replace(
    'navigate("/user/login");',
    'redirectToLoginAfterLogout(navigate);'
  );
  fs.writeFileSync(userMainPath, userMainContent, 'utf8');
  console.log('Updated UserMainPage.js');
}

