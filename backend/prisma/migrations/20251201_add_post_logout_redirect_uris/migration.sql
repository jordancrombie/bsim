-- Add postLogoutRedirectUris column to oauth_clients table
-- This column is required for RP-Initiated Logout (OIDC front-channel logout)
ALTER TABLE "oauth_clients" ADD COLUMN "postLogoutRedirectUris" TEXT[] DEFAULT ARRAY[]::TEXT[];
