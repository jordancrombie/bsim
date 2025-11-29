# BSIM Authorization Server

OpenID Connect (OIDC) Authorization Server for the BSIM Banking Simulator. This server enables third-party applications to securely access user banking data through OAuth 2.0 authorization flows.

## Overview

The Authorization Server implements the OpenID Connect specification using the [oidc-provider](https://github.com/panva/node-oidc-provider) library, providing:

- **OAuth 2.0 Authorization Code Flow** with PKCE support
- **OpenID Connect** identity layer
- **Dynamic Client Registration** from database
- **Consent Management** with account selection
- **JWT Access Tokens** signed with RS256
- **OIDC Discovery** for automatic client configuration

## Endpoints

### OIDC Discovery

```bash
# OpenID Configuration (auto-discovery)
GET https://auth.banksim.ca/.well-known/openid-configuration

# JSON Web Key Set (for token verification)
GET https://auth.banksim.ca/.well-known/jwks.json
```

### OAuth 2.0 / OIDC

| Endpoint | URL | Description |
|----------|-----|-------------|
| Authorization | `/auth` | Initiates OAuth flow, redirects to login |
| Token | `/token` | Exchange authorization code for tokens |
| UserInfo | `/userinfo` | Get authenticated user's profile |
| End Session | `/session/end` | RP-Initiated Logout |
| Revocation | `/token/revoke` | Revoke access/refresh tokens |
| Introspection | `/token/introspect` | Check token validity |

### Interaction (User-Facing)

| Endpoint | Description |
|----------|-------------|
| `GET /interaction/:uid` | Display login or consent page |
| `POST /interaction/:uid/login` | Process login submission |
| `POST /interaction/:uid/confirm` | Process consent confirmation |
| `POST /interaction/:uid/abort` | Handle consent denial |

### Administration

| Endpoint | Description |
|----------|-------------|
| `GET /administration` | List all OAuth clients |
| `GET /administration/clients/new` | Create new client form |
| `POST /administration/clients` | Create new client |
| `GET /administration/clients/:id` | Edit client form |
| `POST /administration/clients/:id` | Update client |
| `POST /administration/clients/:id/delete` | Delete client |

## Supported Scopes

| Scope | Description | Claims |
|-------|-------------|--------|
| `openid` | OpenID Connect authentication | `sub` |
| `profile` | User profile information | `name`, `given_name`, `family_name`, `birthdate` |
| `email` | Email address | `email`, `email_verified` |
| `fdx:accountdetailed:read` | Read account details and balances | - |
| `fdx:transactions:read` | Read transaction history | - |
| `fdx:customercontact:read` | Read contact information | `phone_number`, `address` |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3003` |
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `ISSUER` | OIDC Issuer URL | `https://auth.banksim.ca` |
| `COOKIE_KEYS` | Comma-separated cookie encryption keys | Required |
| `JWKS_SECRET` | JWKS signing key (for development) | Required |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | See env.ts |

### Example Configuration

```env
PORT=3003
NODE_ENV=production
DATABASE_URL=postgresql://bsim:password@db:5432/bsim
ISSUER=https://auth.banksim.ca
COOKIE_KEYS=key1-32-chars-minimum,key2-32-chars-minimum
CORS_ORIGIN=https://banksim.ca,https://auth.banksim.ca,https://ssim.banksim.ca
```

## OAuth Client Registration

### Using the Admin Interface

Navigate to `https://auth.banksim.ca/administration` to:
- View all registered OAuth clients
- Create new clients with auto-generated secrets
- Edit client settings (redirect URIs, scopes, branding)
- Regenerate client secrets
- Enable/disable clients

### Manual Database Registration

```sql
INSERT INTO oauth_clients (
  id, "clientId", "clientSecret", "clientName",
  "redirectUris", "postLogoutRedirectUris",
  "grantTypes", "responseTypes", scope,
  "logoUri", "isActive", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'my-app-client',
  'your-64-char-hex-secret',  -- Use: openssl rand -hex 32
  'My Application',
  ARRAY['https://myapp.com/callback', 'http://localhost:3000/callback'],
  ARRAY['https://myapp.com', 'http://localhost:3000'],
  ARRAY['authorization_code'],
  ARRAY['code'],
  'openid profile email fdx:accountdetailed:read fdx:transactions:read',
  'https://myapp.com/logo.png',
  true,
  NOW(), NOW()
);
```

**Important:** Client secrets are stored in plaintext (oidc-provider performs direct string comparison).

## Integration Guide

### 1. OIDC Auto-Discovery

Most OAuth/OIDC libraries support auto-discovery. Simply configure the issuer URL:

```javascript
// Example with openid-client (Node.js)
const { Issuer } = require('openid-client');

const bsimIssuer = await Issuer.discover('https://auth.banksim.ca');
console.log('Discovered issuer:', bsimIssuer.issuer);

const client = new bsimIssuer.Client({
  client_id: 'your-client-id',
  client_secret: 'your-client-secret',
  redirect_uris: ['https://yourapp.com/callback'],
  response_types: ['code'],
});
```

### 2. Authorization Request

Redirect users to the authorization endpoint:

```
https://auth.banksim.ca/auth?
  client_id=your-client-id&
  redirect_uri=https://yourapp.com/callback&
  response_type=code&
  scope=openid profile email fdx:accountdetailed:read&
  state=random-state-value&
  code_challenge=...&
  code_challenge_method=S256
```

### 3. Token Exchange

Exchange the authorization code for tokens:

```bash
curl -X POST https://auth.banksim.ca/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTHORIZATION_CODE" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "client_id=your-client-id" \
  -d "client_secret=your-client-secret" \
  -d "code_verifier=..."
```

### 4. Access Protected Resources

Use the access token to call the Open Banking API:

```bash
curl https://openbanking.banksim.ca/accounts \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Token Lifetimes

| Token Type | Lifetime |
|------------|----------|
| Access Token | 1 hour |
| Authorization Code | 10 minutes |
| Refresh Token | 30 days |
| Session | 14 days |
| Grant | 30 days |

## Development

### Local Development

```bash
cd auth-server

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run in development mode
npm run dev
```

### Docker Build

```bash
# Build the container
docker build -t bsim-auth-server .

# Run with Docker Compose
docker compose up auth-server
```

### Project Structure

```
auth-server/
├── src/
│   ├── config/
│   │   ├── database.ts    # Prisma client singleton
│   │   ├── env.ts         # Environment configuration
│   │   └── oidc.ts        # OIDC provider configuration
│   ├── adapters/
│   │   └── prisma.ts      # Prisma adapter for oidc-provider
│   ├── routes/
│   │   ├── admin.ts       # OAuth client management
│   │   └── interaction.ts # Login/consent UI routes
│   ├── views/
│   │   ├── login.ejs      # Login page template
│   │   ├── consent.ejs    # Consent page template
│   │   └── admin/         # Admin interface templates
│   └── server.ts          # Express application
├── prisma/
│   └── schema.prisma      # Database schema
├── Dockerfile
└── package.json
```

## Security Considerations

1. **Client Secrets**: Store securely, use environment variables in production
2. **JWKS Keys**: The RSA key pair in `oidc.ts` should be rotated periodically
3. **Cookie Keys**: Use strong, random values for cookie encryption
4. **HTTPS**: Always use HTTPS in production
5. **CORS**: Restrict allowed origins to known clients

## Troubleshooting

### Common Issues

**"invalid_client" error**
- Verify client secret is correct (plaintext, not hashed)
- Check client is marked as active in database

**"redirect_uri_mismatch" error**
- Ensure redirect URI exactly matches one in `redirectUris` array
- Check for trailing slashes

**CORS errors**
- Add client origin to `CORS_ORIGIN` environment variable
- Restart the auth-server container

**Token validation fails**
- Verify JWKS endpoint is accessible
- Check token hasn't expired
- Ensure audience matches expected value

### Viewing Logs

```bash
# Docker logs
docker compose logs auth-server -f

# Filter for OIDC events
docker compose logs auth-server | grep OIDC
```

## Related Documentation

- [BSIM README](../README.md) - Main project documentation
- [Open Banking API](../openbanking/README.md) - Resource server documentation
- [OPENBANKING_PLAN.md](../OPENBANKING_PLAN.md) - Architecture overview
- [oidc-provider docs](https://github.com/panva/node-oidc-provider/tree/main/docs) - Underlying library
