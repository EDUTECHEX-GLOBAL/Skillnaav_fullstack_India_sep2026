const notFound = (req, res, next) => {
  res.status(404);
  res.json({ message: "Not Found" });
};

const errorHandler = (err, req, res, next) => {
  console.error("🔥 Global Error Handler caught:", err);
  
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  let errorMessage = err.message || "";
  if (err.name === 'MulterError' || errorMessage.includes('Invalid file type') || errorMessage.includes('too large')) {
    statusCode = 400;
  }
  
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
