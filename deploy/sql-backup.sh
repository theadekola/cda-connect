#!/usr/bin/env bash
set -euo pipefail
umask 077
kind="${1:-full}"
case "$kind" in full) operation=DATABASE; extension=bak;; log) operation=LOG; extension=trn;; *) exit 2;; esac
: "${SQLCMDPASSWORD:?Set SQLCMDPASSWORD in /etc/cda-connect/backup.env}"
: "${SQL_BACKUP_USER:?Set SQL_BACKUP_USER in /etc/cda-connect/backup.env}"
sqlcmd="${SQLCMD_BIN:-/opt/mssql-tools18/bin/sqlcmd}"
test -x "$sqlcmd"
exec 9>/var/lock/cda-connect-backup.lock
flock -w 600 9
stamp="$(date -u +%Y%m%dT%H%M%S)-$$"
file="/var/opt/mssql/backup/CDAConnect_${stamp}.${extension}"
# Local SQL VM connection; -C trusts its private server certificate, with encryption enabled.
"$sqlcmd" -S tcp:127.0.0.1,1433 -U "$SQL_BACKUP_USER" -N -C -b -V 16 -l 15 -t 600 -Q "BACKUP $operation [CDAConnect] TO DISK=N'$file' WITH CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'$file' WITH CHECKSUM;"
echo "Verified backup: $file"
# Retain all files until an off-VM copy and a restore drill have established a retention policy.
