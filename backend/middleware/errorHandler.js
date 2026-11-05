exports.notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Central error handler: keeps stack traces out of API responses in production.
exports.errorHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier format';
  } else if (err.code === 11000) {
    status = 409;
    message = 'A duplicate record already exists';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  }

  if (status >= 500) {
    console.error('Unhandled error:', err);
    if (process.env.NODE_ENV === 'production') message = 'Internal Server Error';
  }

  res.status(status).json({ message });
};
