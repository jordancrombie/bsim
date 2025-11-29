import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config/env';

// Extend Express Request to include token info
declare global {
  namespace Express {
    interface Request {
      token?: {
        sub: string;
        scope: string;
        scopes: string[];
        aud: string | string[];
        iss: string;
        exp: number;
        iat: number;
      };
    }
  }
}

// JWKS client for fetching public keys
const jwks = jwksClient({
  jwksUri: config.auth.jwksUri,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// Get signing key from JWKS
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Token validation middleware
export function validateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'No access token provided',
    });
  }

  const token = authHeader.substring(7);

  jwt.verify(
    token,
    getKey,
    {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
    },
    (err, decoded) => {
      if (err) {
        console.error('Token validation error:', err.message);
        return res.status(401).json({
          error: 'invalid_token',
          error_description: err.message,
        });
      }

      const payload = decoded as jwt.JwtPayload;

      req.token = {
        sub: payload.sub || '',
        scope: payload.scope || '',
        scopes: (payload.scope || '').split(' ').filter(Boolean),
        aud: payload.aud || '',
        iss: payload.iss || '',
        exp: payload.exp || 0,
        iat: payload.iat || 0,
      };

      next();
    }
  );
}

// Scope checking middleware factory
export function requireScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.token) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'No token information available',
      });
    }

    const hasAllScopes = requiredScopes.every((scope) =>
      req.token!.scopes.includes(scope)
    );

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Required scopes: ${requiredScopes.join(', ')}`,
        scope: requiredScopes.join(' '),
      });
    }

    next();
  };
}
