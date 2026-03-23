const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dispatch.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    machine TEXT,
    status TEXT NOT NULL,
    current_task TEXT,
    next_action TEXT,
    note TEXT,
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
  );
`);

// Shared constants — single source of truth
const VALID_STATUSES = ['me', 'claude', 'blocked', 'done'];
const GENERIC_PHRASES = ['claude session ended', 'session ended', 'review and continue'];

// Build the NOT IN clause from GENERIC_PHRASES
const genericPlaceholders = GENERIC_PHRASES.map(() => '?').join(', ');

// Prepared statements
const ensureProject = db.prepare(
  'INSERT OR IGNORE INTO projects (name, display_name) VALUES (?, ?)'
);

const insertUpdate = db.prepare(`
  INSERT INTO updates (project_name, machine, status, current_task, next_action, note)
  VALUES (@project_name, @machine, @status, @current_task, @next_action, @note)
`);

const insertUpdateTx = db.transaction((data) => {
  ensureProject.run(data.project_name, data.project_name);
  const info = insertUpdate.run(data);
  return info.lastInsertRowid;
});

const getProjectsWithLatest = db.prepare(`
  SELECT
    p.name,
    p.display_name,
    u.machine,
    u.status,
    u.current_task,
    u.next_action,
    u.note,
    u.posted_at
  FROM projects p
  LEFT JOIN updates u ON u.id = (
    SELECT id FROM updates WHERE project_name = p.name ORDER BY id DESC LIMIT 1
  )
  ORDER BY u.posted_at DESC
`);

const getHistoryStmt = db.prepare(`
  SELECT machine, status, current_task, next_action, note, posted_at
  FROM updates
  WHERE project_name = ?
    AND LOWER(TRIM(COALESCE(current_task, ''))) NOT IN (${genericPlaceholders})
  ORDER BY id DESC
  LIMIT 20
`);

const getLatestUpdateStmt = db.prepare(`
  SELECT current_task, next_action, note
  FROM updates
  WHERE project_name = ?
  ORDER BY id DESC
  LIMIT 1
`);

const deleteProjectStmt = db.prepare('DELETE FROM projects WHERE name = ?');

const updateDisplayNameStmt = db.prepare(
  'UPDATE projects SET display_name = ? WHERE name = ?'
);

module.exports = {
  VALID_STATUSES,
  GENERIC_PHRASES,

  postUpdate(data) {
    return insertUpdateTx({
      project_name: data.project,
      machine: data.machine || null,
      status: data.status,
      current_task: data.current_task || null,
      next_action: data.next_action || null,
      note: data.note || null,
    });
  },

  getProjects() {
    return getProjectsWithLatest.all().map(r => ({
      name: r.name,
      display_name: r.display_name,
      latest: r.status ? {
        machine: r.machine,
        status: r.status,
        current_task: r.current_task,
        next_action: r.next_action,
        note: r.note,
        posted_at: r.posted_at,
      } : null,
    }));
  },

  getHistory(name) {
    return getHistoryStmt.all(name, ...GENERIC_PHRASES);
  },

  getLatestUpdate(projectName) {
    return getLatestUpdateStmt.get(projectName) || null;
  },

  deleteProject(name) {
    return deleteProjectStmt.run(name);
  },

  updateDisplayName(name, displayName) {
    return updateDisplayNameStmt.run(displayName, name);
  },
};
