#!/bin/bash
# 执行 Test 聚合考试迁移：migrate_tests.sql
# 用法：在 backend_server 目录下执行 ./database/run_migrate_tests.sh
# 或：cd backend_server && bash database/run_migrate_tests.sh

set -e
cd "$(dirname "$0")/.."
SCRIPT_DIR="$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  echo "请配置 .env 中的 DB_NAME、DB_USER、DB_PASSWORD（或设置环境变量）"
  exit 1
fi

echo "执行迁移: $SCRIPT_DIR/migrate_tests.sql -> 数据库 $DB_NAME"
if [ -n "$DB_PASSWORD" ]; then
  export MYSQL_PWD="$DB_PASSWORD"
fi
mysql -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" "$DB_NAME" < "$SCRIPT_DIR/migrate_tests.sql"
unset MYSQL_PWD 2>/dev/null || true
echo "迁移完成。"
