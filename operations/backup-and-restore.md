# Backup and restore

WRDL keeps seven daily and four weekly encrypted database backups outside the
repository and hosting project. Backup files, decrypted dumps, checksums, target
URLs, and encryption identities must never be committed.

## Prerequisites

- Native Windows `pg_dump`, `pg_restore`, and `psql` matching the hosted
  PostgreSQL major version.
- Native GnuPG with an owner-controlled encryption recipient.
- An explicit backup folder outside this repository.
- A separate, disposable Supabase/PostgreSQL restore target that is not staging
  or production.

## Create an encrypted backup

Set `WRDL_DATABASE_URL` only in the current PowerShell process, then run:

```powershell
./scripts/New-WrdlBackup.ps1 -OutputDirectory "D:\WRDL Backups" -Recipient "owner-backup-key"
```

The script creates a custom-format dump, encrypts it immediately, deletes the
plaintext in a `finally` block, and writes a SHA-256 checksum. Copy the encrypted
file and checksum to the approved external backup location.

## Isolated restore drill

Set `WRDL_RESTORE_DATABASE_URL` to the disposable target and run:

```powershell
./scripts/Test-WrdlRestore.ps1 -BackupFile "D:\WRDL Backups\wrdl-...dump.gpg" -ConfirmIsolatedTarget
```

The script refuses a target matching `WRDL_STAGING_DATABASE_URL` or
`WRDL_PRODUCTION_DATABASE_URL`. After restoration it verifies core schemas and
restores the allowlisted WRDL trigger and policies attached to Supabase-managed
tables, then deletes the temporary plaintext. Manually run the database
acceptance suite and application smoke checklist against that isolated target.

Record only the date, encrypted file name, checksum match, restore duration, and
pass/fail result. A clean staging release requires a successful pre-migration
backup and isolated restore rehearsal.

## Latest drill

On 2026-09-03, `wrdl-20260903-000327.dump.gpg` passed its SHA-256 check,
restored into the disposable `wrdl-restore-test` project, and passed all ten
rollback-only database acceptance suites, including the 100-player M10 fixture.
No plaintext dump was retained.
