-- Optional tables for reviewed Excel imports. Contains no source document bodies.
-- Apply within the same transaction as the selected node and History insertion.
CREATE TABLE imported_route_schedules (
  route_id TEXT PRIMARY KEY REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  period_raw TEXT NOT NULL,
  interval_days INTEGER NOT NULL CHECK(typeof(interval_days)='integer' AND interval_days BETWEEN 1 AND 366000),
  policy TEXT NOT NULL DEFAULT 'excel_months_times_30' CHECK(policy='excel_months_times_30')
);
CREATE TABLE imported_source_batches (
  id TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  excel_sha256 TEXT NOT NULL CHECK(length(excel_sha256)=64),
  notion_sha256 TEXT NOT NULL CHECK(length(notion_sha256)=64),
  selection_json TEXT NOT NULL CHECK(json_valid(selection_json)),
  policy TEXT NOT NULL
);
CREATE TABLE imported_page_sources (
  page_id TEXT PRIMARY KEY CHECK(length(page_id)=32),
  route_id TEXT NOT NULL REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  url TEXT NOT NULL CHECK(url LIKE 'https://www.notion.so/%'),
  role TEXT NOT NULL CHECK(role IN ('base','absorbed_bsa')),
  batch_id TEXT NOT NULL REFERENCES imported_source_batches(id) ON DELETE RESTRICT
);
CREATE TABLE imported_history_sources (
  history_id TEXT PRIMARY KEY REFERENCES history_nodes(id) ON DELETE RESTRICT,
  batch_id TEXT NOT NULL REFERENCES imported_source_batches(id) ON DELETE RESTRICT,
  source_sheet TEXT NOT NULL,
  source_row INTEGER NOT NULL CHECK(source_row>1),
  event_hash TEXT NOT NULL CHECK(length(event_hash)=64),
  UNIQUE(batch_id,source_sheet,source_row)
);
