let _io = null;

const setIO = (ioInstance) => {
  _io = ioInstance;
};

const getIO = () => {
  return _io;
};

module.exports = {
  setIO,
  getIO,
};