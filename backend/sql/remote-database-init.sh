#!/usr/bin/env bash
set -euo pipefail

SQL_ADMIN="${1:-sa}"
APP_LOGIN="${2:-community_app}"
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
if [[ ! -x "$SQLCMD" ]]; then
  SQLCMD=/opt/mssql-tools/bin/sqlcmd
fi
if [[ ! -x "$SQLCMD" ]]; then
  echo "sqlcmd was not found in /opt/mssql-tools18/bin or /opt/mssql-tools/bin." >&2
  exit 1
fi

read -rsp "SQL admin password: " SA_PASSWORD
echo
read -rsp "New ${APP_LOGIN} password: " APP_PASSWORD
echo

"$SQLCMD" -S localhost -U "$SQL_ADMIN" -P "$SA_PASSWORD" -C -b \
  -i /tmp/cda-database-bootstrap.sql \
  -v "AppLogin=$APP_LOGIN" "AppPassword=$APP_PASSWORD"

"$SQLCMD" -S localhost -U "$SQL_ADMIN" -P "$SA_PASSWORD" -C -b \
  -d CDAConnect -i /tmp/cda-schema.sql

rm -f /tmp/cda-schema.sql /tmp/cda-database-bootstrap.sql /tmp/cda-remote-database-init.sh
echo "CDAConnect database and application login were created successfully."
