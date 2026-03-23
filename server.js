require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3131;
const startTime = Date.now();

// Security headers (CSP disabled — inline styles used by vanilla frontend)
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting
const writeLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many requests' } });
const readLimiter = rateLimit({ windowMs: 60_000, max: 120, message: { error: 'Too many requests' } });

// Body parsing with size limit
app.use(express.json({ limit: '2kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Validation helpers
const PROJECT_RE = /^[a-z0-9][a-z0-9._-]{0,99}$/i;
const MAX_TEXT = 500;

function trimText(val, maxLen) {
  if (val == null || typeof val !== 'string') return null;
  return val.slice(0, maxLen);
}

// Health check
app.get('/health', readLimiter, (req, res) => {
  res.json({ ok: true, uptime: Math.floor((Date.now() - startTime) / 1000) });
});

// Post a status update
app.post('/update', writeLimiter, (req, res) => {
  const { project, status } = req.body;

  if (!project || !status) {
    return res.status(400).json({ error: 'project and status are required' });
  }
  if (!PROJECT_RE.test(project)) {
    return res.status(400).json({ error: 'project must be alphanumeric with hyphens/dots, 1-100 chars' });
  }
  if (!db.VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${db.VALID_STATUSES.join(', ')}` });
  }

  const sanitized = {
    project,
    status,
    machine: trimText(req.body.machine, 100),
    current_task: trimText(req.body.current_task, MAX_TEXT),
    next_action: trimText(req.body.next_action, MAX_TEXT),
    note: trimText(req.body.note, MAX_TEXT),
  };

  // For generic hook noise, carry forward the previous meaningful description
  const task = (sanitized.current_task || '').toLowerCase().trim();
  if (db.GENERIC_PHRASES.some(p => task === p)) {
    const prev = db.getLatestUpdate(project);
    if (prev) {
      sanitized.current_task = prev.current_task;
      sanitized.next_action = prev.next_action;
      sanitized.note = prev.note;
    }
    const id = db.postUpdate(sanitized);
    console.log(`[${new Date().toISOString()}] UPDATE (status only): ${project} → ${status}`);
    return res.json({ ok: true, id: Number(id) });
  }

  const id = db.postUpdate(sanitized);
  console.log(`[${new Date().toISOString()}] UPDATE: ${project} → ${status} (${sanitized.current_task || 'no task'})`);
  res.json({ ok: true, id: Number(id) });
});

// Get all projects with latest update
app.get('/projects', readLimiter, (req, res) => {
  res.json(db.getProjects());
});

// Get history for a project
app.get('/projects/:name/history', readLimiter, (req, res) => {
  res.json(db.getHistory(req.params.name));
});

// Delete a project
app.delete('/projects/:name', writeLimiter, (req, res) => {
  db.deleteProject(req.params.name);
  console.log(`[${new Date().toISOString()}] DELETED: ${req.params.name}`);
  res.json({ ok: true });
});

// Update display name
app.post('/projects/:name/display-name', writeLimiter, (req, res) => {
  const displayName = trimText(req.body.display_name, 100);
  if (!displayName) {
    return res.status(400).json({ error: 'display_name is required' });
  }
  db.updateDisplayName(req.params.name, displayName);
  res.json({ ok: true });
});

// Global error handler — no stack traces in response
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  res.status(status).json({ error: status === 400 ? 'Bad request' : 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dispatch server running on http://0.0.0.0:${PORT}`);
});
