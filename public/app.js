const grid = document.getElementById('projectGrid');
const clock = document.getElementById('clock');
const syncText = document.getElementById('syncText');
const connectionDot = document.getElementById('connectionDot');
const addForm = document.getElementById('addForm');
const btnAdd = document.getElementById('btnAdd');
const btnSubmitAdd = document.getElementById('btnSubmitAdd');
const btnCancelAdd = document.getElementById('btnCancelAdd');
const statusPopover = document.getElementById('statusPopover');
const btnPopSubmit = document.getElementById('btnPopSubmit');
const btnPopCancel = document.getElementById('btnPopCancel');
const historyOverlay = document.getElementById('historyOverlay');
const btnCloseHistory = document.getElementById('btnCloseHistory');

const REFRESH_INTERVAL = 30000;
const RECENT_THRESHOLD = 120000; // 2 minutes

let projects = [];
let popoverProject = null;

// Helpers
function parseUTC(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
}

function timeAgo(dateStr) {
  const posted = parseUTC(dateStr);
  if (!posted) return '';
  const secs = Math.floor((Date.now() - posted.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isRecent(dateStr) {
  const posted = parseUTC(dateStr);
  return posted ? (Date.now() - posted.getTime()) < RECENT_THRESHOLD : false;
}

// Escape for HTML text content
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Escape for HTML attribute values
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Post an update to the server
async function postStatusUpdate(body) {
  try {
    const res = await fetch('/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.status);
    return true;
  } catch {
    connectionDot.className = 'connection-dot err';
    return false;
  }
}

// Clock
function updateClock() {
  clock.textContent = new Date().toLocaleTimeString('en-US', { hour12: true });
}
updateClock();
setInterval(updateClock, 1000);

// Render — uses event delegation instead of per-element listeners
function render() {
  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h2>No projects yet</h2>
        <p>Click "+ Add Project" or POST to /update to get started</p>
      </div>`;
    return;
  }

  grid.innerHTML = projects.map(p => {
    const u = p.latest || {};
    const status = u.status || 'done';
    const recent = isRecent(u.posted_at) ? ' recent' : '';
    const displayName = p.display_name || p.name;

    return `
      <div class="project-card status-${status}${recent}" data-name="${escAttr(p.name)}">
        <div class="card-header">
          <span class="project-name">${esc(displayName)}</span>
          <span class="status-badge ${status}" data-badge="${escAttr(p.name)}">
            <span class="status-dot"></span>
            ${status.toUpperCase()}
          </span>
        </div>
        <div class="card-body">
          ${u.current_task ? `<div class="card-field"><span class="label">Doing</span><span class="value">${esc(u.current_task)}</span></div>` : ''}
          ${u.next_action ? `<div class="card-field"><span class="label">Next</span><span class="value">${esc(u.next_action)}</span></div>` : ''}
          ${u.note ? `<div class="card-field"><span class="label">Note</span><span class="value">${esc(u.note)}</span></div>` : ''}
        </div>
        <div class="card-footer">
          <span>${u.machine ? esc(u.machine) + ' · ' : ''}${timeAgo(u.posted_at)}</span>
          <button class="btn-edit" data-edit="${escAttr(p.name)}">Edit</button>
        </div>
      </div>`;
  }).join('');
}

// Event delegation on grid — one listener handles cards, badges, and edit buttons
grid.addEventListener('click', (e) => {
  const badge = e.target.closest('.status-badge');
  const editBtn = e.target.closest('.btn-edit');
  const card = e.target.closest('.project-card');

  if (badge) {
    e.stopPropagation();
    openPopover(badge.dataset.badge);
  } else if (editBtn) {
    e.stopPropagation();
    openPopover(editBtn.dataset.edit);
  } else if (card) {
    showHistory(card.dataset.name);
  }
});

// Fetch projects
async function fetchProjects() {
  try {
    const res = await fetch('/projects');
    if (!res.ok) throw new Error(res.status);
    projects = await res.json();
    connectionDot.className = 'connection-dot ok';
    syncText.textContent = 'Synced ' + new Date().toLocaleTimeString('en-US', { hour12: true });
    render();
  } catch {
    connectionDot.className = 'connection-dot err';
    syncText.textContent = 'Disconnected';
  }
}

fetchProjects();
setInterval(fetchProjects, REFRESH_INTERVAL);

// Add project form
btnAdd.addEventListener('click', () => {
  addForm.style.display = addForm.style.display === 'none' ? 'flex' : 'none';
});
btnCancelAdd.addEventListener('click', () => {
  addForm.style.display = 'none';
});
btnSubmitAdd.addEventListener('click', async () => {
  const project = document.getElementById('addName').value.trim();
  const status = document.getElementById('addStatus').value;
  if (!project) return;

  await postStatusUpdate({
    project,
    status,
    machine: 'dashboard',
    current_task: document.getElementById('addTask').value.trim() || undefined,
    next_action: document.getElementById('addNext').value.trim() || undefined,
    note: document.getElementById('addNote').value.trim() || undefined,
  });

  const displayName = document.getElementById('addDisplay').value.trim();
  if (displayName) {
    try {
      await fetch(`/projects/${encodeURIComponent(project)}/display-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      });
    } catch { /* non-critical */ }
  }

  document.getElementById('addName').value = '';
  document.getElementById('addDisplay').value = '';
  document.getElementById('addTask').value = '';
  document.getElementById('addNext').value = '';
  document.getElementById('addNote').value = '';
  addForm.style.display = 'none';
  fetchProjects();
});

// Status popover
function openPopover(projectName) {
  popoverProject = projectName;
  const p = projects.find(x => x.name === projectName);
  document.getElementById('popoverTitle').textContent = `Update: ${p?.display_name || projectName}`;
  document.getElementById('popStatus').value = p?.latest?.status || 'me';
  document.getElementById('popTask').value = '';
  document.getElementById('popNext').value = '';
  document.getElementById('popNote').value = '';
  statusPopover.style.display = 'flex';
}

btnPopCancel.addEventListener('click', () => {
  statusPopover.style.display = 'none';
});
statusPopover.addEventListener('click', (e) => {
  if (e.target === statusPopover) statusPopover.style.display = 'none';
});

btnPopSubmit.addEventListener('click', async () => {
  if (!popoverProject) return;
  await postStatusUpdate({
    project: popoverProject,
    status: document.getElementById('popStatus').value,
    machine: 'dashboard',
    current_task: document.getElementById('popTask').value.trim() || undefined,
    next_action: document.getElementById('popNext').value.trim() || undefined,
    note: document.getElementById('popNote').value.trim() || undefined,
  });
  statusPopover.style.display = 'none';
  fetchProjects();
});

// History panel
async function showHistory(name) {
  const p = projects.find(x => x.name === name);
  document.getElementById('historyTitle').textContent = `${p?.display_name || name} — History`;

  try {
    const res = await fetch(`/projects/${encodeURIComponent(name)}/history`);
    if (!res.ok) throw new Error(res.status);
    const history = await res.json();
    const list = document.getElementById('historyList');

    if (history.length === 0) {
      list.innerHTML = '<p style="color:var(--text-dim)">No updates yet.</p>';
    } else {
      list.innerHTML = history.map(h => `
        <div class="history-entry">
          <div class="he-top">
            <span class="he-status ${h.status}">${h.status.toUpperCase()}</span>
            <span class="he-time">${h.machine ? esc(h.machine) + ' · ' : ''}${timeAgo(h.posted_at)}</span>
          </div>
          ${h.current_task ? `<div class="he-field"><span class="he-label">Doing:</span> ${esc(h.current_task)}</div>` : ''}
          ${h.next_action ? `<div class="he-field"><span class="he-label">Next:</span> ${esc(h.next_action)}</div>` : ''}
          ${h.note ? `<div class="he-field"><span class="he-label">Note:</span> ${esc(h.note)}</div>` : ''}
        </div>
      `).join('');
    }

    historyOverlay.style.display = 'flex';
  } catch {
    connectionDot.className = 'connection-dot err';
  }
}

btnCloseHistory.addEventListener('click', () => {
  historyOverlay.style.display = 'none';
});
historyOverlay.addEventListener('click', (e) => {
  if (e.target === historyOverlay) historyOverlay.style.display = 'none';
});
