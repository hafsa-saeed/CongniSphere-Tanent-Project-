const ApiError = require('../utils/ApiError');

/**
 * Centralized error handler. Every asyncHandler-wrapped controller
 * forwards errors here via next(err). Also normalizes common Mongoose
 * errors (validation, duplicate key, cast) into clean ApiError-shaped
 * JSON responses instead of leaking stack traces to the client.
 */
// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode = error.statusCode || 500;
    let message = error.message || 'Internal Server Error';

    // Mongoose validation error
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
    }

    // Mongoose duplicate key error
    if (error.code === 11000) {
      statusCode = 409;
      const field = Object.keys(error.keyValue || {})[0];
      message = `Duplicate value for field "${field}". It must be unique.`;
    }

    // Mongoose invalid ObjectId
    if (error.name === 'CastError') {
      statusCode = 400;
      message = `Invalid value for field "${error.path}".`;
    }

    error = new ApiError(statusCode, message, error.errors || [], err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  };

  return res.status(error.statusCode).json(response);
};

module.exports = errorMiddleware;
