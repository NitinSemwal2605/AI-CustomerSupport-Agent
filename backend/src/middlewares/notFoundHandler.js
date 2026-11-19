/**
 * 404 Route Not Found Handler
 */

function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`
  });
}

module.exports = notFoundHandler;
