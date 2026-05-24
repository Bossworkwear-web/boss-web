# Supabase database backup

Regular **Postgres dumps** for disaster recovery (site outage, bad migration, accidental deletes, compromise).  
Store dumps **off this Mac** — same places as code backups: **Google Drive** and **External 4T HD**.

Code backups (`scripts/backup-boss-web.sh`) do **not** include Supabase data. Use this script for the DB.

---

## 1. Supabase Dashboard (built-in)

On **Pro** and above, Supabase keeps **daily backups** (and PITR on higher tiers).  
Check: **Project → Database → Backups**.

Use Dashboard backups as the first line of defence; this script is your **second copy** you control (Drive + external disk).

---

## 2. One-time setup on this Mac

### A. Install `pg_dump`

```bash
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
pg_dump --version
```

(Intel Mac: path may be `/usr/local/opt/libpq/bin`.)

### B. Database connection URL

1. Supabase → **Project Settings → Database**
2. **Connection string** → **URI** (Session pooler or Direct — both work for `pg_dump`)
3. Replace `[YOUR-PASSWORD]` with the database password

Add to **`boss-web/.env.local`** (never commit):

```env
SUPABASE_DB_DIRECT_URL=postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

---

## 3. Run a backup manually

External disk mounted (optional but recommended):

```bash
cd dev/boss-web

BACKUP_EXTERNAL_ROOT="/Volumes/External 4T HD/Boss Workwear" \
  bash scripts/backup-supabase-db.sh
```

Or:

```bash
npm run backup:db
```

(with the same `BACKUP_EXTERNAL_ROOT` env if you use the external disk)

### Where files go

| Location | Path |
|----------|------|
| Google Drive | `My Drive/Boss_Web/archives/db/supabase-db-YYYYMMDD-HHMMSS.sql.gz` |
| External 4T HD | `Boss Workwear/archives/db/supabase-db-YYYYMMDD-HHMMSS.sql.gz` |

- Temp file is created in system `/tmp` and **deleted** after copy.
- By default **8** newest dumps are kept per folder (`BACKUP_DB_KEEP=8`); older ones are pruned.

---

## 4. Schedule (weekly recommended)

### Option A — macOS `launchd` (example: Sundays 02:00)

1. Copy and edit the plist:

```bash
cp scripts/com.bossworkwear.supabase-db-backup.plist.example \
  ~/Library/LaunchAgents/com.bossworkwear.supabase-db-backup.plist
```

2. Open the plist and set:
   - `BACKUP_EXTERNAL_ROOT` if the external disk is always mounted at the same path
   - `StandardOutPath` / `StandardErrorPath` log paths

3. Load:

```bash
launchctl load ~/Library/LaunchAgents/com.bossworkwear.supabase-db-backup.plist
```

4. Test once:

```bash
launchctl start com.bossworkwear.supabase-db-backup
```

### Option B — cron

```cron
0 2 * * 0 cd /Users/kyliewang/Desktop/Bosss\ WW_Web/dev/boss-web && BACKUP_EXTERNAL_ROOT="/Volumes/External 4T HD/Boss Workwear" bash scripts/backup-supabase-db.sh >> /tmp/supabase-db-backup.log 2>&1
```

**Note:** External disk must be connected at backup time, or only Google Drive will receive the dump (script still succeeds if Drive is available).

---

## 5. Restore (emergency)

**Warning:** Restoring overwrites data in the target database. Test on a **branch** or new project first if possible.

```bash
gunzip -c supabase-db-YYYYMMDD-HHMMSS.sql.gz | psql "$SUPABASE_DB_DIRECT_URL"
```

Or Supabase **SQL Editor** for small sections.

After a compromise: rotate **database password**, **service role key**, and **JWT secret** in Supabase + Vercel, then restore from a **known-good dump** taken before the incident.

---

## 6. Security

- `SUPABASE_DB_DIRECT_URL` contains the DB password — **`.env.local` only**
- Dump files contain **all customer/order data** — treat like production secrets
- Do not commit dumps to git or upload to public storage

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `pg_dump not found` | `brew install libpq` and PATH (see above) |
| `SUPABASE_DB_DIRECT_URL is not set` | Add URI to `.env.local` |
| Connection refused / timeout | Check Supabase project not paused; verify URI/password |
| External backup skipped | Mount **External 4T HD** or omit `BACKUP_EXTERNAL_ROOT` |
