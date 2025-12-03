import Provider, { Configuration, interactionPolicy } from 'oidc-provider';
import { PrismaClient } from '@prisma/client';
import { createPrismaAdapterFactory } from '../adapters/prisma';
import { config } from './env';
import { compare } from 'bcrypt';

// FDX-inspired scopes + Payment scopes
const SCOPES = [
  'openid',
  'profile',
  'email',
  'fdx:accountdetailed:read',
  'fdx:transactions:read',
  'fdx:customercontact:read',
  // Payment Network scopes
  'payment:authorize',  // Authorize a single payment with selected card
];

// Claims mapping for each scope
const CLAIMS = {
  openid: ['sub'],
  profile: ['name', 'family_name', 'given_name', 'birthdate'],
  email: ['email', 'email_verified'],
  'fdx:accountdetailed:read': [],
  'fdx:transactions:read': [],
  'fdx:customercontact:read': ['phone_number', 'address'],
  'payment:authorize': ['card_token'],  // Card token for payment authorization
};

export function createOidcProvider(prisma: PrismaClient): Provider {
  const oidcConfig: Configuration = {
    adapter: createPrismaAdapterFactory(prisma),

    // Client authentication
    clients: [], // Clients loaded from database

    // Enable dynamic client lookup from database
    // Note: The 'id' parameter can be either the internal user ID (during login)
    // or the fiUserRef (when looking up account for token generation)
    // We use fiUserRef as the accountId/sub for all external tokens
    async findAccount(ctx, id) {
      // Try to find user by internal ID first (used during login flow)
      let user = await prisma.user.findUnique({
        where: { id },
        include: { accounts: true },
      });

      // If not found, try by fiUserRef (used when generating tokens)
      if (!user) {
        user = await prisma.user.findUnique({
          where: { fiUserRef: id },
          include: { accounts: true },
        });
      }

      if (!user) return undefined;

      return {
        // Use fiUserRef as the accountId - this becomes the 'sub' claim in access tokens
        accountId: user.fiUserRef,
        async claims(use, scope) {
          // Use fiUserRef as the subject identifier for external consumers
          // This provides a stable, external-facing identifier for Open Banking
          const claims: Record<string, any> = {
            sub: user.fiUserRef,
          };

          if (scope.includes('profile')) {
            claims.name = `${user.firstName} ${user.lastName}`;
            claims.given_name = user.firstName;
            claims.family_name = user.lastName;
            if (user.dateOfBirth) {
              claims.birthdate = user.dateOfBirth.toISOString().split('T')[0];
            }
          }

          if (scope.includes('email')) {
            claims.email = user.email;
            claims.email_verified = true; // For simulation purposes
          }

          if (scope.includes('fdx:customercontact:read')) {
            if (user.phone) claims.phone_number = user.phone;
            if (user.address) {
              claims.address = {
                street_address: user.address,
                locality: user.city,
                region: user.state,
                postal_code: user.postalCode,
                country: user.country,
              };
            }
          }

          return claims;
        },
      };
    },

    // Scopes and claims
    scopes: SCOPES,
    claims: CLAIMS,

    // Features
    features: {
      devInteractions: { enabled: false }, // We provide our own UI
      resourceIndicators: {
        enabled: true,
        defaultResource: (ctx) => config.openbanking.audience,
        useGrantedResource: (ctx) => true,
        getResourceServerInfo: (ctx, resourceIndicator) => {
          // Log the resource indicator for debugging
          console.log(`[OIDC] getResourceServerInfo called with resource: ${resourceIndicator}`);
          console.log(`[OIDC] Expected audience: ${config.openbanking.audience}`);

          // Always return the Open Banking resource server config
          // This handles cases where:
          // 1. No resource is specified (falls back to default)
          // 2. The correct resource is specified
          // 3. An unknown resource is specified (we still return our default to avoid errors)
          return {
            scope: 'openid profile email fdx:accountdetailed:read fdx:transactions:read fdx:customercontact:read',
            audience: config.openbanking.audience,
            accessTokenFormat: 'jwt',
            jwt: {
              sign: { alg: 'RS256' },
            },
          };
        },
      },
      rpInitiatedLogout: {
        enabled: true,
      },
    },

    // Token formats - always use JWT for access tokens
    // The resourceIndicators feature handles JWT format for resource-bound tokens
    formats: {
      AccessToken: 'jwt',
    },

    // TTLs
    ttl: {
      AccessToken: 3600, // 1 hour
      AuthorizationCode: 600, // 10 minutes
      RefreshToken: 30 * 24 * 3600, // 30 days
      Interaction: 3600, // 1 hour
      Session: 14 * 24 * 3600, // 14 days
      Grant: 30 * 24 * 3600, // 30 days
    },

    // Cookies
    cookies: {
      keys: config.oidc.cookieKeys,
      long: {
        signed: true,
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: config.nodeEnv === 'production',
      },
      short: {
        signed: true,
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: config.nodeEnv === 'production',
      },
    },

    // JWKS - RSA key pair for signing JWTs
    // In production, these should be stored securely (e.g., AWS Secrets Manager)
    jwks: {
      keys: [
        {
          kty: 'RSA',
          kid: 'sig-rs256-1',
          use: 'sig',
          alg: 'RS256',
          n: 'sIRIMB2_7KTDjsjt6lp-38VLaNrK8ukccuIzSa3rkdP2ysLEdYRM00i5bxxCOddNGIeFGQsIcEtmZ2EpuK3AO6cEcRoGX10JMUEJc9yLz5QXxhCuDP3fiF0DGPrsVISQ-UYQh225H_e_xwGcX0XPh3hLpD1Oa6_Q6OVprodiLC_7X4SsbWHTonBX6as52iVkOrKAip8kwzCRs6Wna_4rX6KlwESTjYD-yZsZntvJ1VOesH2mMVl_xMRSpPsMg_rhSuHqzGcx_iBYT79wtbqtSqKvawTHpDD13PfNqMQDiYTKj8lYD7y7GtBSkCy6cjllsln0kyxSlssQr9V0Fyptow',
          e: 'AQAB',
          d: 'FLhidOt5FQE-R2uEqgbXb9MMCBHu0tbUVRQCazq0NVkJVkHIp_bQwdh-k_FgQMPqM9_smsT1x6DCM45vRFN5BkeTuOcSKm2UX6i_wE76RnKe28wncjT24V3xuCP0S_OHxQsZc5xIp90AMQ8aWQCr3L4dOvlLVE6-Giib4DXaK0-AkudrSbCykxYwj8adyagODpU4Rte99JFRVz8KV1cgTIEI5OMHlGmgzjFYINXFvuE_Bny_LyWl8CdH0_Haxjy9-TWUiCYrM8SkLjx7hIP-kP1K2gmLjw2lLVM8I5Btvvk_jF_iZPOSTYMFmkb5lmDe1bXWEXpdEbZ-q1kjeNHPYQ',
          p: '4rLfcA1vNISieLqpXOm9Ntc5SGxl1VNWgiYfYWVbmMGN3yQIHX6JxftfUVJh7hxZCvZqHT41SbpKuwcu1N9nkWNZ1UGDEVBQTNfhZBQPIQXfCQF19QouO7VQROsmhQgkPtVMrFrMik960s4hLnMYxOHcs8ZuxFBDubsbCS0ZN9M',
          q: 'x1T19Z_OilvXInAGTawpOgu_AXmimv-qeklkz4OKl44H0VyDZGgsqFKjQ2JoqwRAbbu_a--NmLa-JLyW6ryVkWUqyLcGwd_3YUKrLU9CW0kPywoSrfobnFb161jd6HqwSx34iRIl9TFAKijaEYaEL5Yy628NItrTVOXknm2zoPE',
          dp: '1w8R4N8dzBi3eQi7eqVTFx99_DK5OHLi8nzv8BmTl4qm6DTqbfCJCwS5HBCnTpgd8MRrTmqhatwL4Pmjd9aoDcjOg_yuNlKWmw-BhstwvscvGwADwv5xdbs_9uGNnU5n9COtpSROPjfAMRPTbplJuhz6nqF0m0_5r8zMjRv3fHk',
          dq: 'SwAxx6jImxCxYvjJtmIH5RpUVSbCQxXdvENvVhFFjX7YfDMWESqNWww09_7IKUjhQSi6fs9U9NgVtVbsZghtMpbhQUJ0nXA68XKXW-YNrrFP6vKwUpvf1bR2tYXrgTTgrnLpeBHHDHnqjbJvUtbNV-Zo5GMViz7Q84nIur_GLdE',
          qi: 'DFV5d2jkG0v5Rno_xJX8q0-CQR_62ZZGgcxeyUfDb5UU7dMJpNhfBTF_gwCm15MCkJG5FFv0eScvb9cqX9Cn1DuXGg84JG0VxJmlmROFHp_zM56An_GuT1NNhkXNJuXRmbQcCgdt_acWFDNviLGJgD4unFvzZ2JRchfGHsm7Y80',
        },
      ],
    },

    // Interaction URL for consent/login
    interactions: {
      url: (ctx, interaction) => `/interaction/${interaction.uid}`,
    },

    // Route prefixes
    routes: {
      authorization: '/auth',
      token: '/token',
      userinfo: '/userinfo',
      jwks: '/.well-known/jwks.json',
      revocation: '/token/revoke',
      introspection: '/token/introspect',
      end_session: '/session/end',
    },

    // Render errors
    renderError: async (ctx, out, error) => {
      ctx.type = 'html';
      ctx.body = `<!DOCTYPE html>
<html>
<head>
  <title>Error - BSIM Auth</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <h1 class="error">Error</h1>
  <p>${out.error}</p>
  <p>${out.error_description || ''}</p>
</body>
</html>`;
    },

    // Extra token claims - include card_token for payment flows
    extraTokenClaims: async (ctx, token) => {
      // Check if this is a payment flow with a card token
      if (token.grantId) {
        try {
          const grantData = await prisma.oidcPayload.findFirst({
            where: { id: token.grantId },
          });
          if (grantData) {
            const payload = grantData.payload as any;
            if (payload.cardToken) {
              console.log('[OIDC] Adding card_token to access token');
              return { card_token: payload.cardToken };
            }
          }
        } catch (err) {
          console.error('[OIDC] Error fetching grant for card_token:', err);
        }
      }
      return {};
    },
  };

  const provider = new Provider(config.oidc.issuer, oidcConfig);

  // Trust proxy (behind nginx/load balancer)
  provider.proxy = true;

  // Load clients from database - store client metadata for dynamic lookup
  const originalClientFind = provider.Client.find.bind(provider.Client);
  provider.Client.find = async function(clientId: string) {
    console.log(`[OIDC] Looking up client: ${clientId}`);

    // First check if it's already cached
    const cached = await originalClientFind(clientId);
    if (cached) {
      console.log(`[OIDC] Found cached client: ${clientId}`);
      return cached;
    }

    try {
      const dbClient = await prisma.oAuthClient.findUnique({
        where: { clientId, isActive: true },
      });

      if (!dbClient) {
        console.log(`[OIDC] Client not found in database: ${clientId}`);
        return undefined;
      }

      console.log(`[OIDC] Found client in database: ${dbClient.clientName}`);
      console.log(`[OIDC] Client redirect_uris from DB:`, dbClient.redirectUris);

      // Create the client instance by adding it to the provider's store
      // Note: oidc-provider expects snake_case and converts to camelCase internally
      const clientMetadata = {
        client_id: dbClient.clientId,
        client_secret: dbClient.clientSecret,
        client_name: dbClient.clientName,
        redirect_uris: dbClient.redirectUris,
        post_logout_redirect_uris: dbClient.postLogoutRedirectUris || [],
        grant_types: dbClient.grantTypes,
        response_types: dbClient.responseTypes,
        scope: dbClient.scope,
        logo_uri: dbClient.logoUri || undefined,
        policy_uri: dbClient.policyUri || undefined,
        tos_uri: dbClient.tosUri || undefined,
        contacts: dbClient.contacts,
        token_endpoint_auth_method: 'client_secret_post' as const,
      };

      // Use provider's internal Client class to create a proper client instance
      const Client = provider.Client;
      return new Client(clientMetadata as any);
    } catch (error) {
      console.error(`[OIDC] Error looking up client ${clientId}:`, error);
      throw error;
    }
  };

  return provider;
}

// Helper to verify user password during login
export async function verifyUserPassword(
  prisma: PrismaClient,
  email: string,
  password: string
): Promise<{ id: string; fiUserRef: string; email: string; firstName: string; lastName: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fiUserRef: true,
      email: true,
      password: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) return null;

  const isValid = await compare(password, user.password);
  if (!isValid) return null;

  return {
    id: user.id,
    fiUserRef: user.fiUserRef,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}
