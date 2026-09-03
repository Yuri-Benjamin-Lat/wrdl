# WRDL operations

These documents are the owner-facing operating guide for staging and production.
They deliberately do not contain project URLs, access tokens, database passwords,
protected answers, guesses, email addresses, or usernames.

- [Release and rollback](release-and-rollback.md)
- [M11 launch checklist](m11-launch-checklist.md)
- [Incidents and recovery](incident-and-recovery.md)
- [Backup and restore](backup-and-restore.md)
- [M10 security review](m10-security-review.md)
- [M10 performance baseline](m10-performance-baseline.md)

Run `pnpm release:check` from the repository root before every staging or
production deployment. Database tests and backup drills use the separately
documented Windows-native tools; Docker and local Supabase are not part of the
WRDL workflow.
