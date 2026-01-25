# Changelog

## [0.7.9] - 2026-01-25

### Fixed
- **CRITICAL:** Fixed wallet enrollments losing OAuth tokens when user starts new OAuth flow
  - Root cause: RefreshTokens created with `expiresWithSession: true` (oidc-provider default)
  - When user starts new OAuth flow → endSession called → Grant revoked → RefreshTokens deleted
  - Symptom: WSIM returns "invalid_grant" / "refresh token not found", requiring re-enrollment
  - Fix: Added `expiresWithSession` hook that returns `false` for `wallet:enroll` scope
  - Wallet RefreshTokens now persist independently of browser sessions
  - File modified: `src/config/oidc.ts`

### Impact
- All existing wallet enrollments are already broken (tokens already deleted)
- Users will need to re-enroll once, then tokens will persist correctly
- New enrollments after this fix will survive session changes

## [0.7.8] - 2026-01-24

### Fixed
- **CRITICAL:** Fixed "interaction session not found" error when switching users
  - Root cause: New interactions inherited grantId from existing session
  - When endSession revoked the old grant, it also deleted the new interaction
  - Fix: Exclude Interaction type from `revokeByGrantId` deletion
  - Interactions now expire naturally via TTL instead of being revoked

## [0.7.7] - 2026-01-24

### Added
- Added `revokeByGrantId` logging with stack trace to identify what's deleting interactions
- Added `grantId` logging to upsert operations

### Investigation
- Confirmed session destroy via `endSession` correlates with interaction deletion
- Suspecting `revokeByGrantId` is cascade-deleting interactions when session is destroyed

## [0.7.6] - 2026-01-24

### Added
- Enhanced debugging for interaction session issues
  - Added `destroy` logging with stack traces to Prisma adapter
  - Added database key logging to `find` operations
  - Added listing of all interactions when NOT FOUND for diagnostics
  - Added OIDC provider lifecycle event listeners (`interaction.started`, `interaction.ended`, `authorization.accepted`, `authorization.success`)

### Fixed
- Investigating "interaction session not found" error during wallet enrollment flow

## [0.7.5] - Previous

- Initial tracked version
