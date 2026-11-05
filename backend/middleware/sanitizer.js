// Defensive input cleaning:
//  1. Removes NoSQL operator keys ($gt, $where, ...) and dotted keys.
//  2. Blocks prototype-pollution keys.
//  3. Recurses through arrays/objects with a depth limit.
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const cleanObject = (value, depth = 0) => {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => cleanObject(item, depth + 1));

  const cleaned = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key)) continue;
    cleaned[key] = cleanObject(value[key], depth + 1);
  }
  return cleaned;
};

exports.mongoSanitize = (req, _res, next) => {
  if (req.body) req.body = cleanObject(req.body);
  if (req.query) req.query = cleanObject(req.query);
  if (req.params) req.params = cleanObject(req.params);
  next();
};
