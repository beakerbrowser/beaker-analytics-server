CREATE TABLE pings (
  id TEXT PRIMARY KEY NOT NULL,
  date INTEGER,
  userId TEXT NOT NULL,
  isFirstPing INTEGER,
  ip TEXT,
  beakerVersion TEXT,
  os TEXT
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY NOT NULL,
  computeDate INTEGER,
  activeUserCount INTEGER,
  totalUserCount INTEGER
);

CREATE TABLE report_data (
  reportId TEXT NOT NULL,
  data TEXT,
  FOREIGN KEY (reportId) REFERENCES reports (id)
);

CREATE TABLE report_active_user_cohorts (
  reportId TEXT NOT NULL,
  startWeek TEXT,
  totalCount INTEGER,
  stillActiveCount INTEGER,
  FOREIGN KEY (reportId) REFERENCES reports (id)
);

PRAGMA user_version = 1;
