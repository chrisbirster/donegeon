# 0) Optional backup first
turso db export donegeon --output-file donegeon-backup.db --overwrite

# 1) Stop app traffic while resetting DB
flyctl scale count 0 --app donegeon -y

# 2) Destroy + recreate Turso DB (hard wipe)
turso db destroy donegeon -y
turso db create donegeon --location aws-us-east-1 --wait

# 3) Create a fresh DB auth token
NEW_TOKEN="$(turso db tokens create donegeon)"

# 4) Set Fly DB secrets to the recreated DB
flyctl secrets set \
  DONEGEON_DB_BACKEND=turso \
  DONEGEON_DB_URL=libsql://donegeon-chrisbirster.aws-us-east-1.turso.io \
  DONEGEON_DB_AUTH_TOKEN="$NEW_TOKEN" \
  --app donegeon

# 5) (Recommended) remove old legacy Turso secret names if still present
flyctl secrets unset DONEGEON_DB_TURSO_URL DONEGEON_DB_TURSO_AUTH_TOKEN --app donegeon

# 6) Bring app back and run deploy (app runs migrations on startup)
flyctl scale count 1 --app donegeon -y
task deploy:app
