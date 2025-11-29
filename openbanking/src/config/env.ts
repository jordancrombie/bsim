export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://bsim:bsim_dev_password@localhost:5432/bsim',
  },
  auth: {
    issuer: process.env.AUTH_SERVER_ISSUER || 'https://auth.banksim.ca',
    jwksUri: process.env.JWKS_URI || 'https://auth.banksim.ca/.well-known/jwks.json',
    audience: process.env.AUDIENCE || 'https://openbanking.banksim.ca',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
