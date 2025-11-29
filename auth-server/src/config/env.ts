export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://bsim:bsim_dev_password@localhost:5432/bsim',
  },
  oidc: {
    issuer: process.env.ISSUER || 'https://auth.banksim.ca',
    // Cookies encryption keys - should be 32 bytes each in production
    cookieKeys: (process.env.COOKIE_KEYS || 'dev-cookie-key-1,dev-cookie-key-2').split(','),
    // JWKS signing key - should be secure in production
    jwksSecret: process.env.JWKS_SECRET || 'dev-jwks-secret-key-change-in-production',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://banksim.ca,https://auth.banksim.ca,https://openbanking.banksim.ca,http://localhost:3005',
  },
};
