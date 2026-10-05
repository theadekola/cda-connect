#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
test "$(id -u)" = 0 || { echo 'Run with sudo on the SQL VM.' >&2; exit 1; }
install -d -m 700 /etc/cda-connect
install -d -o mssql -g mssql -m 700 /var/opt/mssql/backup
test -s /etc/cda-connect/backup.env || { echo 'Create root-owned mode-600 /etc/cda-connect/backup.env containing SQL_BACKUP_USER and SQLCMDPASSWORD first.' >&2; exit 1; }
chown root:root /etc/cda-connect/backup.env
chmod 600 /etc/cda-connect/backup.env
install -m 700 sql-backup.sh /usr/local/sbin/cda-sql-backup
install -m 644 cda-sql-full.service cda-sql-full.timer cda-sql-log.service cda-sql-log.timer /etc/systemd/system/
systemctl daemon-reload
systemctl start cda-sql-full.service
systemctl enable --now cda-sql-full.timer cda-sql-log.timer
systemctl list-timers 'cda-sql-*'
