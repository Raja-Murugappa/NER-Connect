
CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    photo TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    gps_accuracy REAL NOT NULL,
    verification_status TEXT NOT NULL,
    verification_reason TEXT,
    exif_latitude REAL,
    exif_longitude REAL,
    timestamp TEXT NOT NULL
);
