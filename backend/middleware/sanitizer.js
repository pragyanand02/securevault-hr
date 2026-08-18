// Middleware to sanitize request body, query, and params against NoSQL operator injection (e.g. $where, $gt, etc.)
const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    // Prohibit keys starting with $ or containing . (MongoDB query operators)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      cleaned[key] = cleanObject(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
};

exports.mongoSanitize = (req, res, next) => {
  if (req.body) req.body = cleanObject(req.body);
  if (req.query) req.query = cleanObject(req.query);
  if (req.params) req.params = cleanObject(req.params);
  next();
};
