const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const dns = require('dns');

// Some campus/hostel networks block SRV DNS lookups used by MongoDB Atlas.
dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(','));

dotenv.config();

const { validateEnv } = require('./config/env');
validateEnv();

const connectDB = require('./config/db');
const { mongoSanitize } = require('./middleware/sanitizer');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { encryptionInfo } = require('./utils/encryption');
const { getChainState } = require('./utils/auditChain');

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const auditRoutes = require('./routes/auditRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const privacyRoutes = require('./routes/privacyRoutes');
const accessRoutes = require('./routes/accessRoutes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // this is a JSON API; the SPA sets its own policy
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize);

app.use('/api', apiLimiter);

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SecureVault HR API',
    positioning: 'DPDP-ready employee data trust layer',
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      encryption: encryptionInfo(),
      auditChain: await getChainState(),
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ status: 'degraded', message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/access', accessRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`SecureVault HR API running on port ${PORT}`);
    console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (require.main === module) {
  start();
}

module.exports = app;
