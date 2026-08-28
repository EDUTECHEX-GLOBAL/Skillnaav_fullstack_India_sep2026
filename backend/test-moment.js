const moment = require('moment'); 
const d = '2026-06-25T00:00:00.000Z'; 
const m = moment.utc(d).utcOffset('+05:30').set({ hour: 16, minute: 18, second: 0, millisecond: 0 }); 
console.log(m.toDate().toISOString());
