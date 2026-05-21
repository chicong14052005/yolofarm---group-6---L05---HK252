"""Import humidity data from Adafruit JSON dump into sensor_data table."""
import json
from datetime import datetime, timedelta, timezone

import mysql.connector

DB_CONFIG = dict(host="localhost", port=3307, user="root", password="root", database="yolofarm")
LOCAL_TZ = timezone(timedelta(hours=7))


def parse_ts(iso_str: str) -> str:
    """Convert UTC ISO 8601 to local MySQL-compatible datetime string."""
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    return dt.astimezone(LOCAL_TZ).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")

JSON_PATH = r"./humidity.json"

with open(JSON_PATH) as f:
    records = json.load(f)

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()

# Check existing count for humidity
cursor.execute("SELECT COUNT(*) FROM sensor_data WHERE sensor_type = 'humidity'")
existing = cursor.fetchone()[0]
print(f"Existing humidity records: {existing}")

inserted = 0
skipped = 0
batch = []
BATCH_SIZE = 200

for r in records:
    created_at = parse_ts(r["created_at"])
    value = float(r["value"])

    # Check duplicate by recorded_at + value
    cursor.execute(
        "SELECT id FROM sensor_data WHERE sensor_type='humidity' AND recorded_at=%s AND value=%s",
        (created_at, value),
    )
    if cursor.fetchone():
        skipped += 1
        continue

    batch.append((created_at, value))

    if len(batch) >= BATCH_SIZE:
        cursor.executemany(
            "INSERT INTO sensor_data (sensor_type, value, recorded_at) VALUES ('humidity', %s, %s)",
            [(v, t) for t, v in batch],
        )
        conn.commit()
        inserted += len(batch)
        batch = []
        print(f"  Inserted {inserted} / skipped {skipped} ...")

if batch:
    cursor.executemany(
        "INSERT INTO sensor_data (sensor_type, value, recorded_at) VALUES ('humidity', %s, %s)",
        [(v, t) for t, v in batch],
    )
    conn.commit()
    inserted += len(batch)

cursor.execute("SELECT COUNT(*) FROM sensor_data WHERE sensor_type = 'humidity'")
total = cursor.fetchone()[0]
cursor.close()
conn.close()

print(f"\nDone! Inserted: {inserted}, Skipped (duplicates): {skipped}")
print(f"Total humidity records now: {total}")
