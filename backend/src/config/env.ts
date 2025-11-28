import dotenv from 'dotenv';

dotenv.config();

// Build CORS origins dynamically from domain configuration
const buildCorsOrigins = (): string | string[] => {
  const domain = process.env.DOMAIN || 'localhost';
  const frontendPort = process.env.FRONTEND_PORT || '3000';

  // If CORS_ORIGIN is explicitly set, use it
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',');
  }

  // Otherwise, build from domain
  const origins = [
    `https://localhost:${frontendPort}`,
    `https://${domain}:${frontendPort}`,
    `http://localhost:${frontendPort}`, // Fallback for development
  ];

  // Remove duplicates
  return [...new Set(origins)];
};

export const config: {
  port: number;
  nodeEnv: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origin: string | string[];
  };
  database: {
    url: string | undefined;
  };
} = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origin: buildCorsOrigins(),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
};
