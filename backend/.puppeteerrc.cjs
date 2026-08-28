const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer so it is stored inside the project folder
  // rather than ~/.cache/puppeteer. This ensures Render doesn't delete it between build and deploy.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
