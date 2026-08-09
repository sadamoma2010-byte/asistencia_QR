export default () => ({
  api: {
    port: parseInt(process.env.API_PORT ?? '4000', 10),
    prefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  app: {
    env: process.env.NODE_ENV ?? 'development',
    timezone: process.env.APP_TIMEZONE ?? 'America/Bogota',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-please-32',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-please-32',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
    loginRateTtl: parseInt(process.env.LOGIN_RATE_TTL ?? '60', 10),
    loginRateLimit: parseInt(process.env.LOGIN_RATE_LIMIT ?? '5', 10),
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? '5', 10),
    loginLockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES ?? '15', 10),
  },
});
