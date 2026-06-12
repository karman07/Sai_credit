export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri:
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017/insurance_crm',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TTL_DAYS ?? '7', 10),
    maxSessions: parseInt(process.env.MAX_SESSIONS_PER_USER ?? '3', 10),
  },
  bootstrap: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@insurancecrm.local',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'Admin@12345',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim()),
});
