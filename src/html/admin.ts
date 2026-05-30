import { themeHeadScript, themeCssVars, themeToggleBtn, themeBodyScript } from './theme.js';

export function renderAdmin(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Uptime Monitor</title>
  ${themeHeadScript()}
  <style>
    ${themeCssVars()}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text)}
    .sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;background:var(--sidebar);color:#94a3b8;padding:1.5rem 1rem;display:flex;flex-direction:column;gap:.25rem}
    .sidebar h1{display:flex;align-items:center;gap:.5rem;color:#f1f5f9;font-size:.95rem;font-weight:700;margin-bottom:1rem;letter-spacing:.02em}
    .sidebar-logo{height:28px;width:28px;border-radius:5px;flex-shrink:0}
    .sidebar a{display:block;padding:.5rem .75rem;border-radius:6px;text-decoration:none;color:#94a3b8;font-size:.875rem;cursor:pointer;transition:all .15s}
    .sidebar a:hover,.sidebar a.active{background:var(--sidebar-hover);color:#f1f5f9}
    .sidebar-footer{margin-top:auto;padding-top:.5rem}
    .main{margin-left:220px;padding:2rem}
    .page{display:none}.page.active{display:block}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
    .header h2{font-size:1.2rem;font-weight:600;color:var(--heading)}
    .btn{padding:.5rem 1rem;border-radius:6px;border:none;font-size:.875rem;font-weight:500;cursor:pointer;transition:all .15s}
    .btn-primary{background:#3b82f6;color:white}.btn-primary:hover{background:#2563eb}
    .btn-danger{background:#fee2e2;color:#dc2626}.btn-danger:hover{background:#fecaca}
    .btn-ghost{background:transparent;color:var(--text-muted);border:1px solid var(--border)}.btn-ghost:hover{background:var(--border-faint);color:var(--text)}
    .btn-sm{padding:.25rem .625rem;font-size:.8rem}
    .card{background:var(--surface);border-radius:8px;border:1px solid var(--border);margin-bottom:1rem}
    .th{display:grid;grid-template-columns:1.5rem 1fr 1fr 7rem 6rem 7rem 15rem;align-items:center;padding:.75rem 1rem;gap:.75rem;background:var(--bg);border-bottom:1px solid var(--border);font-size:.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;border-radius:8px 8px 0 0}
    .mrow{display:grid;grid-template-columns:1.5rem 1fr 1fr 7rem 6rem 7rem 15rem;align-items:center;padding:.875rem 1rem;gap:.75rem;border-bottom:1px solid var(--border-faint)}
    .mrow:last-child{border-bottom:none}.mrow:hover{background:var(--border-faint)}
    .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .dot-up{background:#22c55e;box-shadow:0 0 0 3px #dcfce7}
    .dot-down{background:#ef4444;box-shadow:0 0 0 3px #fee2e2}
    .dot-unknown{background:#94a3b8;box-shadow:0 0 0 3px var(--border-faint)}
    .mname{font-weight:500;font-size:.875rem}
    .murl{font-size:.8rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .badge{display:inline-block;padding:.2rem .5rem;border-radius:4px;font-size:.75rem;font-weight:500}
    .badge-up{background:#dcfce7;color:#16a34a}
    .badge-down{background:#fee2e2;color:#dc2626}
    .badge-unknown{background:var(--border-faint);color:var(--text-muted)}
    .actions{display:flex;gap:.4rem}
    .modal-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;align-items:center;justify-content:center}
    .modal-backdrop.open{display:flex}
    .modal{background:var(--surface);border-radius:10px;padding:1.5rem;width:480px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.15)}
    .modal h3{font-size:1rem;font-weight:600;margin-bottom:1.25rem}
    .fg{margin-bottom:1rem}
    .fg label{display:block;font-size:.8rem;font-weight:500;color:var(--text);margin-bottom:.35rem}
    .fg input,.fg select{width:100%;padding:.5rem .75rem;border:1px solid var(--input-border);border-radius:6px;font-size:.875rem;outline:none;transition:border .15s;background:var(--surface);color:var(--text)}
    .fg input:focus,.fg select:focus{border-color:var(--accent)}
    .frow{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
    .mf{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1.5rem}
    .pages-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem}
    .pcard{background:var(--surface);border-radius:8px;border:1px solid var(--border);padding:1rem}
    .pcard-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem}
    .pcard h3{font-size:.9rem;font-weight:600}
    .pslug{font-size:.75rem;color:var(--text-muted);margin-top:.15rem}
    .pcard-actions{display:flex;gap:.4rem}
    .chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem}
    .chip{display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .5rem;border-radius:4px;font-size:.75rem;background:var(--border-faint);color:var(--text)}
    .chip-x{cursor:pointer;color:var(--text-faint);font-size:.85rem;line-height:1}.chip-x:hover{color:#ef4444}
    .padd{display:flex;gap:.5rem;align-items:center}
    .padd select{padding:.4rem .6rem;border:1px solid var(--border);border-radius:6px;font-size:.8rem;background:var(--surface);color:var(--text);cursor:pointer}
    .empty{text-align:center;padding:3rem;color:var(--text-faint);font-size:.875rem}
    .htable{width:100%;border-collapse:collapse;font-size:.8rem}
    .htable th{text-align:left;padding:.4rem .75rem;color:var(--text-muted);font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border)}
    .htable td{padding:.5rem .75rem;border-bottom:1px solid var(--bg);vertical-align:middle}
    .hrow-down{background:var(--row-down-bg)}.hrow-down .htime{color:#ef4444}
    .herr{color:#ef4444;font-size:.75rem;max-width:220px;word-break:break-all}
    .hm-scroll{max-height:62vh;overflow-y:auto}
    .domain-row{display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border-faint);margin-bottom:.625rem;font-size:.8rem}
    .domain-val{color:var(--accent);font-weight:500;flex:1}
    .domain-input{flex:1;padding:.35rem .5rem;border:1px solid var(--border);border-radius:6px;font-size:.8rem;outline:none;background:var(--surface);color:var(--text)}
    .domain-input:focus{border-color:var(--accent)}
    .notices-hdr{display:flex;justify-content:space-between;align-items:center;margin:.875rem 0 .4rem;border-top:1px solid var(--border-faint);padding-top:.875rem}
    .notices-label{font-size:.72rem;font-weight:600;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em}
    .nitem{padding:.5rem .625rem;border-radius:6px;margin-bottom:.35rem;font-size:.8rem}
    .nitem-info{background:var(--blue-bg);color:var(--blue-text);border:1px solid var(--blue-border)}
    .nitem-warning{background:var(--yellow-bg);color:var(--yellow-text);border:1px solid var(--yellow-border)}
    .nitem-critical{background:var(--red-bg);color:var(--red-text);border:1px solid var(--red-border)}
    .nitem-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem}
    .nitem-sev{font-size:.7rem;font-weight:600;text-transform:capitalize;opacity:.75}
    .nitem-msg{font-weight:500;line-height:1.4}
    .nitem-actions{display:flex;gap:.3rem}
    .fg textarea{width:100%;padding:.5rem .75rem;border:1px solid var(--input-border);border-radius:6px;font-size:.875rem;outline:none;transition:border .15s;resize:vertical;min-height:80px;font-family:inherit;background:var(--surface);color:var(--text)}
    .fg textarea:focus{border-color:var(--accent)}
    .toast{position:fixed;bottom:1.5rem;right:1.5rem;padding:.75rem 1.25rem;border-radius:8px;font-size:.875rem;font-weight:500;color:white;z-index:200;animation:sIn .2s ease}
    .toast-success{background:#22c55e}.toast-error{background:#ef4444}
    @keyframes sIn{from{transform:translateX(100%);opacity:0}to{transform:none;opacity:1}}
    .overlay{display:none;position:fixed;inset:0;background:var(--bg);z-index:50;align-items:center;justify-content:center}
    .overlay.show{display:flex}
    .login-box{background:var(--surface);border-radius:10px;border:1px solid var(--border);padding:2rem;width:360px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
    .login-box h2{font-size:1.1rem;font-weight:600;margin-bottom:.25rem}
    .login-box p{font-size:.85rem;color:var(--text-muted);margin-bottom:1.25rem}
  </style>
</head>
<body>

<!-- Login overlay -->
<div id="login-overlay" class="overlay show">
  <div class="login-box">
    <h2>Uptime Monitor</h2>
    <p>Enter your API key to continue</p>
    <div class="fg">
      <label>API Key</label>
      <input id="login-key" type="password" placeholder="your-secret-key" onkeydown="if(event.key==='Enter')login()">
    </div>
    <button class="btn btn-primary" style="width:100%" onclick="login()">Sign in</button>
    <div id="login-err" style="color:#ef4444;font-size:.8rem;margin-top:.75rem;display:none"></div>
  </div>
</div>

<div id="app" style="display:none">
  <div class="sidebar">
    <h1><img src="https://cloudflare-uptime.andrs.nu/logo.png" class="sidebar-logo" alt="">Uptime Monitor</h1>
    <a class="active" onclick="showPage('monitors',this)">Monitors</a>
    <a onclick="showPage('pages',this)">Status Pages</a>
    <div class="sidebar-footer">${themeToggleBtn('color:#94a3b8')}</div>
  </div>

  <div class="main">
    <div id="page-monitors" class="page active">
      <div class="header">
        <h2>Monitors</h2>
        <button class="btn btn-primary" onclick="openMonitorModal()">+ Add Monitor</button>
      </div>
      <div id="monitors-container"><div class="empty">Loading...</div></div>
    </div>

    <div id="page-pages" class="page">
      <div class="header">
        <h2>Status Pages</h2>
        <button class="btn btn-primary" onclick="openPageModal()">+ New Status Page</button>
      </div>
      <div id="pages-container"><div class="empty">Loading...</div></div>
    </div>
  </div>
</div>

<!-- History Modal -->
<div id="history-modal" class="modal-backdrop">
  <div class="modal" style="width:620px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
      <h3 id="hm-title">Check History</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeHistoryModal()">Close</button>
    </div>
    <div id="hm-body" class="hm-scroll"></div>
  </div>
</div>

<!-- Monitor Modal -->
<div id="monitor-modal" class="modal-backdrop">
  <div class="modal">
    <h3 id="mm-title">Add Monitor</h3>
    <div class="fg"><label>Name</label><input id="m-name" type="text" placeholder="My Website"></div>
    <div class="fg"><label>URL</label><input id="m-url" type="url" placeholder="https://example.com"></div>
    <div class="frow">
      <div class="fg">
        <label>Check Interval</label>
        <select id="m-interval">
          <option value="1">Every 1 minute</option>
          <option value="5">Every 5 minutes</option>
          <option value="10">Every 10 minutes</option>
          <option value="30">Every 30 minutes</option>
        </select>
      </div>
      <div class="fg"><label>Timeout (ms)</label><input id="m-timeout" type="number" value="10000" min="1000" max="30000"></div>
    </div>
    <div class="fg"><label>Expected Status Code (optional, e.g. 401)</label><input id="m-expected-status" type="number" placeholder="Leave blank for any 2xx–3xx" min="100" max="599"></div>
    <div class="fg">
      <label>Attempts before marking down</label>
      <select id="m-retry-count">
        <option value="1">1 — no retries</option>
        <option value="2">2</option>
        <option value="3" selected>3 (default)</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
    </div>
    <div class="fg"><label>Alert Webhook (Slack / Discord / custom)</label><input id="m-webhook" type="url" placeholder="https://hooks.slack.com/..."></div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeMonitorModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveMonitor()">Save Monitor</button>
    </div>
  </div>
</div>

<!-- Notice Modal -->
<div id="notice-modal" class="modal-backdrop">
  <div class="modal">
    <h3>Post Notice</h3>
    <div class="fg"><label>Message</label><textarea id="n-msg" placeholder="Scheduled maintenance tonight at 10pm UTC — API may be briefly unavailable."></textarea></div>
    <div class="fg">
      <label>Severity</label>
      <select id="n-sev">
        <option value="info">Info &mdash; informational update</option>
        <option value="warning">Warning &mdash; possible degradation</option>
        <option value="critical">Critical &mdash; active outage / urgent</option>
      </select>
    </div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeNoticeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNotice()">Post Notice</button>
    </div>
  </div>
</div>

<!-- Status Page Modal -->
<div id="page-modal" class="modal-backdrop">
  <div class="modal">
    <h3>New Status Page</h3>
    <div class="fg"><label>Name</label><input id="p-name" type="text" placeholder="My Services"></div>
    <div class="fg">
      <label>Slug &mdash; visible in the URL: /status/<em>your-slug</em></label>
      <input id="p-slug" type="text" placeholder="my-services" oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')">
    </div>
    <div class="fg"><label>Description (optional)</label><input id="p-desc" type="text" placeholder="Current status of all services"></div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closePageModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePage()">Create Page</button>
    </div>
  </div>
</div>

<script>
  let KEY = localStorage.getItem('uptime_key') || '';
  let monitors = [];
  let pages = [];
  let editingId = null;
  let noticePageId = null;

  function api(path, opts = {}) {
    return fetch(path, {
      ...opts,
      headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) }
    }).then(r => { if (!r.ok && r.status === 401) throw new Error('401'); return r.json(); });
  }

  async function login() {
    const k = document.getElementById('login-key').value.trim();
    if (!k) return;
    try {
      const r = await fetch('/api/monitors', { headers: { 'X-API-Key': k } });
      if (!r.ok) throw new Error('bad key');
      KEY = k;
      localStorage.setItem('uptime_key', k);
      document.getElementById('login-overlay').classList.remove('show');
      document.getElementById('app').style.display = '';
      init();
    } catch {
      const e = document.getElementById('login-err');
      e.style.display = 'block';
      e.textContent = 'Invalid API key. Please try again.';
    }
  }

  function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function showPage(name, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    el.classList.add('active');
  }

  function openMonitorModal(m = null) {
    editingId = m?.id || null;
    document.getElementById('mm-title').textContent = m ? 'Edit Monitor' : 'Add Monitor';
    document.getElementById('m-name').value = m?.name || '';
    document.getElementById('m-url').value = m?.url || '';
    document.getElementById('m-interval').value = m?.interval_minutes || '1';
    document.getElementById('m-timeout').value = m?.timeout_ms || '10000';
    document.getElementById('m-expected-status').value = m?.expected_status_code || '';
    document.getElementById('m-retry-count').value = m?.retry_count ?? 3;
    document.getElementById('m-webhook').value = m?.alert_webhook || '';
    document.getElementById('monitor-modal').classList.add('open');
  }

  function closeMonitorModal() {
    document.getElementById('monitor-modal').classList.remove('open');
    editingId = null;
  }

  async function saveMonitor() {
    const data = {
      name: document.getElementById('m-name').value.trim(),
      url: document.getElementById('m-url').value.trim(),
      interval_minutes: parseInt(document.getElementById('m-interval').value),
      timeout_ms: parseInt(document.getElementById('m-timeout').value),
      expected_status_code: parseInt(document.getElementById('m-expected-status').value) || null,
      retry_count: parseInt(document.getElementById('m-retry-count').value),
      alert_webhook: document.getElementById('m-webhook').value.trim() || null,
    };
    if (!data.name || !data.url) { toast('Name and URL are required', 'error'); return; }
    if (editingId) {
      await api('/api/monitors/' + editingId, { method: 'PUT', body: JSON.stringify(data) });
      toast('Monitor updated');
    } else {
      await api('/api/monitors', { method: 'POST', body: JSON.stringify(data) });
      toast('Monitor created');
    }
    closeMonitorModal();
    await loadMonitors();
  }

  async function deleteMonitor(id) {
    if (!confirm('Delete this monitor? All check history will be lost.')) return;
    await api('/api/monitors/' + id, { method: 'DELETE' });
    toast('Monitor deleted');
    await loadMonitors();
  }

  async function loadMonitors() {
    monitors = (await api('/api/monitors')).sort((a, b) => a.name.localeCompare(b.name));
    renderMonitors();
  }

  function renderMonitors() {
    const el = document.getElementById('monitors-container');
    if (!monitors.length) {
      el.innerHTML = '<div class="empty">No monitors yet. Add one to get started.</div>';
      return;
    }
    const rows = monitors.map((m, i) => {
      const st = m.latest_check ? (m.latest_check.ok ? 'up' : 'down') : 'unknown';
      const label = st === 'up' ? 'Operational' : st === 'down' ? 'Down' : 'No data';
      const uptime = m.uptime_30d !== undefined ? m.uptime_30d + '%' : '—';
      const lat = m.latest_check?.latency_ms != null ? m.latest_check.latency_ms + ' ms' : '—';
      return '<div class="mrow">' +
        '<div class="dot dot-' + st + '"></div>' +
        '<div class="mname">' + esc(m.name) + '</div>' +
        '<div class="murl" title="' + esc(m.url) + '">' + esc(m.url) + '</div>' +
        '<span class="badge badge-' + st + '">' + label + '</span>' +
        '<span style="font-size:.875rem;font-weight:500">' + uptime + '</span>' +
        '<span style="font-size:.875rem;color:var(--text-muted)">' + lat + '</span>' +
        '<div class="actions">' +
        '<button class="btn btn-ghost btn-sm" onclick="openHistoryModal(' + i + ')">History</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="openMonitorModal(monitors[' + i + '])">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteMonitor(monitors[' + i + '].id)">Delete</button>' +
        '</div></div>';
    }).join('');
    el.innerHTML = '<div class="card">' +
      '<div class="th"><span></span><span>Name</span><span>URL</span><span>Status</span><span>30d uptime</span><span>Latency</span><span>Actions</span></div>' +
      rows + '</div>';
  }

  function openPageModal() {
    ['p-name','p-slug','p-desc'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('page-modal').classList.add('open');
  }

  function closePageModal() {
    document.getElementById('page-modal').classList.remove('open');
  }

  async function savePage() {
    const data = {
      name: document.getElementById('p-name').value.trim(),
      slug: document.getElementById('p-slug').value.trim(),
      description: document.getElementById('p-desc').value.trim() || null,
    };
    if (!data.name || !data.slug) { toast('Name and slug are required', 'error'); return; }
    await api('/api/pages', { method: 'POST', body: JSON.stringify(data) });
    toast('Status page created');
    closePageModal();
    await loadPages();
  }

  async function deletePage(id) {
    if (!confirm('Delete this status page?')) return;
    await api('/api/pages/' + id, { method: 'DELETE' });
    toast('Status page deleted');
    await loadPages();
  }

  async function addMonitorToPage(pageId) {
    const sel = document.getElementById('padd-' + pageId);
    if (!sel.value) return;
    await api('/api/pages/' + pageId + '/monitors', { method: 'POST', body: JSON.stringify({ monitor_id: sel.value }) });
    sel.value = '';
    await loadPages();
  }

  async function removeMonitorFromPage(pageId, monitorId) {
    await api('/api/pages/' + pageId + '/monitors/' + monitorId, { method: 'DELETE' });
    await loadPages();
  }

  async function loadPages() {
    const pageList = await api('/api/pages');
    pages = await Promise.all(pageList.map(async p => {
      const [assigned, notices] = await Promise.all([
        api('/api/pages/' + p.id + '/monitors'),
        api('/api/pages/' + p.id + '/notices'),
      ]);
      return { ...p, monitors: assigned, notices };
    }));
    renderPages();
  }

  function openNoticeModal(pageId) {
    noticePageId = pageId;
    document.getElementById('n-msg').value = '';
    document.getElementById('n-sev').value = 'info';
    document.getElementById('notice-modal').classList.add('open');
  }

  function closeNoticeModal() {
    document.getElementById('notice-modal').classList.remove('open');
    noticePageId = null;
  }

  async function saveNotice() {
    const msg = document.getElementById('n-msg').value.trim();
    const sev = document.getElementById('n-sev').value;
    if (!msg) { toast('Message is required', 'error'); return; }
    await api('/api/pages/' + noticePageId + '/notices', { method: 'POST', body: JSON.stringify({ message: msg, severity: sev }) });
    toast('Notice posted');
    closeNoticeModal();
    await loadPages();
  }

  async function uploadLogo(pi) {
    const input = document.getElementById('logo-' + pi);
    const file = input && input.files && input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch('/api/pages/' + pages[pi].id + '/logo', {
      method: 'POST',
      headers: { 'X-API-Key': KEY },
      body: fd,
    });
    const data = await res.json();
    if (data.url) { toast('Logo uploaded'); await loadPages(); }
    else toast(data.error || 'Upload failed', 'error');
  }

  async function removeLogo(pi) {
    await fetch('/api/pages/' + pages[pi].id + '/logo', { method: 'DELETE', headers: { 'X-API-Key': KEY } });
    toast('Logo removed');
    await loadPages();
  }

  async function setCustomDomain(pageId, domain) {
    await api('/api/pages/' + pageId, { method: 'PUT', body: JSON.stringify({ custom_domain: domain || null }) });
    toast(domain ? 'Custom domain saved' : 'Custom domain removed');
    await loadPages();
  }

  function saveCustomDomain(pi) {
    const input = document.getElementById('cdomain-' + pi);
    if (input) setCustomDomain(pages[pi].id, input.value.trim());
  }

  function removeCustomDomain(pi) {
    setCustomDomain(pages[pi].id, null);
  }

  async function setHistoryDays(pageId, days) {
    await api('/api/pages/' + pageId, { method: 'PUT', body: JSON.stringify({ incident_history_days: parseInt(days) }) });
    toast('History window updated');
    await loadPages();
  }

  async function resolveNotice(noticeId, pageId) {
    await api('/api/pages/' + pageId + '/notices/' + noticeId + '/resolve', { method: 'PUT' });
    toast('Notice resolved');
    await loadPages();
  }

  async function deleteNotice(noticeId, pageId) {
    if (!confirm('Delete this notice?')) return;
    await api('/api/pages/' + pageId + '/notices/' + noticeId, { method: 'DELETE' });
    toast('Notice deleted');
    await loadPages();
  }

  function renderPages() {
    const el = document.getElementById('pages-container');
    if (!pages.length) {
      el.innerHTML = '<div class="empty">No status pages yet. Create one to share your uptime publicly.</div>';
      return;
    }
    const cards = pages.map((p, pi) => {
      const assignedIds = (p.monitors || []).map(m => m.id);
      const available = monitors.filter(m => !assignedIds.includes(m.id));
      const chips = (p.monitors || []).map((m, mi) =>
        '<span class="chip">' + esc(m.name) + '<span class="chip-x" onclick="removeMonitorFromPage(pages[' + pi + '].id,pages[' + pi + '].monitors[' + mi + '].id)">×</span></span>'
      ).join('') || '<span style="font-size:.8rem;color:var(--text-faint)">No monitors assigned</span>';
      const opts = available.map(m => '<option value="' + m.id + '">' + esc(m.name) + '</option>').join('');
      const origin = window.location.origin;
      const activeNotices = (p.notices || []).map((n, ni) => ({ n, ni })).filter(({ n }) => !n.resolved_at);
      const noticeHtml = activeNotices.length
        ? activeNotices.map(({ n, ni }) =>
            '<div class="nitem nitem-' + n.severity + '">' +
            '<div class="nitem-top">' +
            '<span class="nitem-sev">' + n.severity + '</span>' +
            '<div class="nitem-actions">' +
            '<button class="btn btn-ghost btn-sm" onclick="resolveNotice(pages[' + pi + '].notices[' + ni + '].id,pages[' + pi + '].id)">Resolve</button>' +
            '<button class="btn btn-danger btn-sm" onclick="deleteNotice(pages[' + pi + '].notices[' + ni + '].id,pages[' + pi + '].id)">&#215;</button>' +
            '</div></div>' +
            '<div class="nitem-msg">' + esc(n.message) + '</div>' +
            '</div>'
          ).join('')
        : '<div style="font-size:.8rem;color:var(--text-faint)">No active notices</div>';

      return '<div class="pcard">' +
        '<div class="pcard-header"><div><h3>' + esc(p.name) + '</h3><div class="pslug">/status/' + esc(p.slug) + '</div></div>' +
        '<div class="pcard-actions">' +
        '<a href="' + origin + '/status/' + p.slug + '" target="_blank" class="btn btn-ghost btn-sm">View &#8599;</a>' +
        '<a href="' + origin + '/status/' + p.slug + '/rss" target="_blank" class="btn btn-ghost btn-sm">RSS</a>' +
        '<button class="btn btn-danger btn-sm" onclick="deletePage(pages[' + pi + '].id)">Delete</button>' +
        '</div></div>' +
        '<div class="domain-row">' +
        (p.logo_url
          ? '<img src="' + esc(p.logo_url) + '" alt="logo" style="height:22px;max-width:80px;object-fit:contain;border-radius:3px"><span class="domain-val" style="font-size:.78rem">Logo set</span><button class="btn btn-ghost btn-sm" onclick="removeLogo(' + pi + ')">Remove</button>'
          : '<input id="logo-' + pi + '" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" style="font-size:.8rem;flex:1;color:var(--text)"><button class="btn btn-ghost btn-sm" onclick="uploadLogo(' + pi + ')">Upload</button>') +
        '</div>' +
        '<div class="domain-row">' +
        (p.custom_domain
          ? '<span class="domain-val">&#127760; ' + esc(p.custom_domain) + '</span><button class="btn btn-ghost btn-sm" onclick="removeCustomDomain(' + pi + ')">Remove</button>'
          : '<input id="cdomain-' + pi + '" class="domain-input" type="text" placeholder="status.example.com"><button class="btn btn-ghost btn-sm" onclick="saveCustomDomain(' + pi + ')">Set domain</button>') +
        '</div>' +
        '<div class="chips">' + chips + '</div>' +
        '<div class="padd">' +
        (opts
          ? '<select id="padd-' + p.id + '"><option value="">Add monitor…</option>' + opts + '</select><button class="btn btn-ghost btn-sm" onclick="addMonitorToPage(pages[' + pi + '].id)">Add</button>'
          : (monitors.length ? '<span style="font-size:.8rem;color:var(--text-faint)">All monitors assigned</span>' : '<span style="font-size:.8rem;color:var(--text-faint)">No monitors created yet</span>')) +
        '</div>' +
        '<div class="notices-hdr"><span class="notices-label">Notices</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="openNoticeModal(pages[' + pi + '].id)">+ Add Notice</button>' +
        '</div>' +
        noticeHtml +
        '<div class="domain-row" style="border-top:1px solid var(--border-faint);margin-top:.5rem;padding-top:.625rem">' +
        '<span style="font-size:.8rem;color:var(--text-muted);flex:1">Incident history window</span>' +
        '<select onchange="setHistoryDays(pages[' + pi + '].id,this.value)" style="padding:.3rem .5rem;border:1px solid var(--border);border-radius:6px;font-size:.8rem;background:var(--surface);color:var(--text);cursor:pointer">' +
        '<option value="30"' + (p.incident_history_days === 30 ? ' selected' : '') + '>30 days</option>' +
        '<option value="90"' + (p.incident_history_days === 90 ? ' selected' : '') + '>90 days</option>' +
        '</select>' +
        '</div>' +
        '</div>';
    }).join('');
    el.innerHTML = '<div class="pages-grid">' + cards + '</div>';
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function ago(ts) {
    const s = Math.floor(Date.now() / 1000) - ts;
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  async function openHistoryModal(i) {
    const m = monitors[i];
    document.getElementById('hm-title').textContent = m.name + ' — Recent Checks';
    document.getElementById('hm-body').innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-faint)">Loading&hellip;</div>';
    document.getElementById('history-modal').classList.add('open');
    const checks = await api('/api/monitors/' + m.id + '/checks?limit=50');
    if (!checks.length) {
      document.getElementById('hm-body').innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-faint)">No checks recorded yet.</div>';
      return;
    }
    const rows = checks.map(c => {
      const ok = c.ok === 1;
      const lat = c.latency_ms != null ? c.latency_ms + ' ms' : '&mdash;';
      const code = c.status_code || '&mdash;';
      const err = c.error ? '<span class="herr">' + esc(c.error) + '</span>' : '';
      return '<tr class="' + (ok ? '' : 'hrow-down') + '">' +
        '<td class="htime">' + ago(c.checked_at) + '</td>' +
        '<td><div class="dot dot-' + (ok ? 'up' : 'down') + '" style="width:8px;height:8px;display:inline-block"></div></td>' +
        '<td>' + code + '</td>' +
        '<td>' + lat + '</td>' +
        '<td>' + err + '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('hm-body').innerHTML =
      '<table class="htable"><thead><tr><th>Time</th><th></th><th>HTTP</th><th>Latency</th><th>Error</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('open');
  }

  async function init() {
    await loadMonitors();
    await loadPages();
    setInterval(loadMonitors, 30000);
  }

  if (KEY) {
    fetch('/api/monitors', { headers: { 'X-API-Key': KEY } }).then(r => {
      if (r.ok) {
        document.getElementById('login-overlay').classList.remove('show');
        document.getElementById('app').style.display = '';
        init();
      } else {
        localStorage.removeItem('uptime_key');
        KEY = '';
      }
    });
  }
</script>
${themeBodyScript()}
</body>
</html>`;
}
