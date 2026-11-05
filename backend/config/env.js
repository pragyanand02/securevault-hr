// Fail fast when the app is not configured securely.
// A security product must never silently fall back to a public/default secret.
const REQUIRED = [
  ['MONGO_URI', 20],
  ['JWT_SECRET', 32],
  ['JWT_REFRESH_SECRET', 32],
  ['AES_SECRET_KEY', 32],
];

exports.validateEnv = () => {
  const problems = [];

  for (const [key, minLength] of REQUIRED) {
    const value = process.env[key];
    if (!value) {
      problems.push(`${key} is missing`);
    } else if (value.length < minLength) {
      problems.push(`${key} is too short (needs ${minLength}+ characters)`);
    }
  }

  if (problems.length > 0) {
    console.error('\n[FATAL] Insecure or incomplete environment configuration:');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nCopy backend/.env.example to backend/.env and set strong, unique values.');
    console.error('The server will not start with weak/default secrets.\n');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.CORS_ORIGIN === '*') {
    console.error('[FATAL] CORS_ORIGIN cannot be "*" in production.');
    process.exit(1);
  }
};
