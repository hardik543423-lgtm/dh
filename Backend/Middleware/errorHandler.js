// Middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error(`[Global Error] ${err.name}: ${err.message}`);
  
  if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
  }

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: messages
      });
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
          success: false,
          error: `Duplicate field value entered: ${field}`
      });
  }

  // Default Fallback Error
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal Server Error',
      // Send stack trace only in dev mode
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};
