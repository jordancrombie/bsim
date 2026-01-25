# Changelog

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
