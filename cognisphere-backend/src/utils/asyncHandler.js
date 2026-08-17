/**
 * Wraps an async Express route handler so any thrown error / rejected
 * promise is forwarded to next(), instead of crashing the process or
 * requiring a try/catch in every single controller.
 *
 * Usage: router.post('/', asyncHandler(async (req, res) => {...}))
 */
const asyncHandler = (requestHandler) => (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next)).catch(next);
};

module.exports = asyncHandler;
