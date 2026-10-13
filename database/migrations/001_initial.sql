-- Target local storage schema; not yet wired to the application.
-- Service code must enable foreign_keys and validate real calendar dates and URLs.
PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE work_nodes (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) > 0),
  kind TEXT NOT NULL CHECK(kind IN ('route','admin')),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  cycle_type TEXT CHECK(cycle_type IN ('monthly','quarterly','annual','weeks','vessels')),
  cycle_count INTEGER CHECK(cycle_count IS NULL OR (typeof(cycle_count) = 'integer' AND cycle_count > 0)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(
    (cycle_type IS NULL AND cycle_count IS NULL) OR
    (cycle_type IS NOT NULL AND cycle_type IN ('monthly','quarterly','annual') AND cycle_count IS NOT NULL AND cycle_count = 1) OR
    (cycle_type IS NOT NULL AND cycle_type IN ('weeks','vessels') AND cycle_count IS NOT NULL)
  ),
  CHECK(kind = 'route' OR cycle_type IS NULL OR cycle_type <> 'vessels')
);

CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  group_name TEXT NOT NULL CHECK(length(trim(group_name)) > 0),
  classification_label TEXT NOT NULL DEFAULT '권역',
  UNIQUE(name,group_name,classification_label)
);

CREATE TABLE route_nodes (
  node_id TEXT PRIMARY KEY REFERENCES work_nodes(id) ON DELETE RESTRICT,
  region_id TEXT REFERENCES regions(id) ON DELETE RESTRICT,
  contract_type TEXT NOT NULL CHECK(contract_type IN ('joint','sell','buy','exchange')),
  start_month TEXT CHECK(start_month IS NULL OR (start_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr(start_month,6,2) BETWEEN '01' AND '12')),
  terminate_month TEXT CHECK(terminate_month IS NULL OR (terminate_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr(terminate_month,6,2) BETWEEN '01' AND '12')),
  termination_reason TEXT,
  remark TEXT NOT NULL DEFAULT '',
  CHECK(terminate_month IS NULL OR start_month IS NULL OR terminate_month >= start_month)
);

CREATE TABLE admin_nodes (
  node_id TEXT PRIMARY KEY REFERENCES work_nodes(id) ON DELETE RESTRICT,
  category TEXT NOT NULL DEFAULT '서무 업무(기타)' CHECK(category = '서무 업무(기타)'),
  recent_update_date TEXT CHECK(recent_update_date IS NULL OR (recent_update_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(recent_update_date,6,2) BETWEEN '01' AND '12' AND substr(recent_update_date,9,2) BETWEEN '01' AND '31')),
  guideline TEXT NOT NULL DEFAULT ''
);

CREATE TRIGGER route_kind_insert BEFORE INSERT ON route_nodes
WHEN (SELECT kind FROM work_nodes WHERE id = NEW.node_id) <> 'route'
BEGIN SELECT RAISE(ABORT,'Route subtype requires route work unit'); END;
CREATE TRIGGER route_kind_update BEFORE UPDATE OF node_id ON route_nodes
WHEN (SELECT kind FROM work_nodes WHERE id = NEW.node_id) <> 'route'
BEGIN SELECT RAISE(ABORT,'Route subtype requires route work unit'); END;
CREATE TRIGGER admin_kind_insert BEFORE INSERT ON admin_nodes
WHEN (SELECT kind FROM work_nodes WHERE id = NEW.node_id) <> 'admin'
BEGIN SELECT RAISE(ABORT,'Admin subtype requires admin work unit'); END;
CREATE TRIGGER admin_kind_update BEFORE UPDATE OF node_id ON admin_nodes
WHEN (SELECT kind FROM work_nodes WHERE id = NEW.node_id) <> 'admin'
BEGIN SELECT RAISE(ABORT,'Admin subtype requires admin work unit'); END;
CREATE TRIGGER work_kind_update BEFORE UPDATE OF kind ON work_nodes
WHEN NEW.kind <> OLD.kind AND (EXISTS(SELECT 1 FROM route_nodes WHERE node_id = OLD.id) OR EXISTS(SELECT 1 FROM admin_nodes WHERE node_id = OLD.id))
BEGIN SELECT RAISE(ABORT,'Cannot change an existing node subtype'); END;

CREATE TABLE route_codes (
  route_id TEXT NOT NULL REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  code TEXT NOT NULL CHECK(length(code) > 0 AND code = upper(code) AND code NOT GLOB '*[^A-Z0-9_]*'),
  position INTEGER NOT NULL CHECK(position >= 0),
  PRIMARY KEY(route_id,code),
  UNIQUE(route_id,position)
);
CREATE TABLE partners (
  code TEXT PRIMARY KEY CHECK(length(code) > 0 AND code = upper(code) AND code NOT GLOB '*[^A-Z0-9_]*'),
  name TEXT NOT NULL
);
CREATE TABLE route_partners (
  route_id TEXT NOT NULL REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  partner_code TEXT NOT NULL REFERENCES partners(code) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK(role IN ('operator','buyer','seller','exchange_partner')),
  PRIMARY KEY(route_id,partner_code,role)
);

-- Metadata and external references only. Never add confidential contract text/files.
CREATE TABLE contract_nodes (
  id TEXT PRIMARY KEY CHECK(length(trim(id)) > 0),
  display_name TEXT NOT NULL,
  notebook_url TEXT CHECK(notebook_url IS NULL OR notebook_url LIKE 'https://%'),
  remark TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE route_contracts (
  route_id TEXT NOT NULL REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  contract_id TEXT NOT NULL REFERENCES contract_nodes(id) ON DELETE RESTRICT,
  PRIMARY KEY(route_id,contract_id)
);

CREATE TABLE history_nodes (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  update_date TEXT NOT NULL CHECK(update_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(update_date,6,2) BETWEEN '01' AND '12' AND substr(update_date,9,2) BETWEEN '01' AND '31'),
  cycle TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX history_route_date ON history_nodes(route_id,update_date DESC);
CREATE TABLE history_items (
  history_id TEXT NOT NULL REFERENCES history_nodes(id) ON DELETE RESTRICT,
  item TEXT NOT NULL CHECK(length(trim(item)) > 0),
  PRIMARY KEY(history_id,item)
);

CREATE TABLE manual_pages (
  route_id TEXT PRIMARY KEY REFERENCES route_nodes(node_id) ON DELETE RESTRICT,
  format_version INTEGER NOT NULL DEFAULT 2 CHECK(format_version = 2),
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📒',
  blocks_json TEXT NOT NULL CHECK(json_valid(blocks_json) AND json_type(blocks_json) = 'array'),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE VIEW work_node_summary AS
SELECT w.id,w.kind,w.name,w.cycle_type,w.cycle_count,r.region_id,r.contract_type,r.terminate_month,
  CASE WHEN w.kind = 'route' THEN (SELECT MAX(h.update_date) FROM history_nodes h WHERE h.route_id = w.id)
       ELSE a.recent_update_date END AS recent_update_date
FROM work_nodes w
LEFT JOIN route_nodes r ON r.node_id = w.id
LEFT JOIN admin_nodes a ON a.node_id = w.id;

INSERT INTO schema_migrations(version) VALUES ('001_initial');
