export function renderHistoryPage(slug: string, isCustomDomain = false): string {
  const statusHref = isCustomDomain ? '/' : `/status/${slug}`;
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Incident History</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b}
    .container{max-width:760px;margin:0 auto;padding:3rem 1.5rem}
    .hdr{margin-bottom:2.5rem}
    .hdr h1{font-size:1.75rem;font-weight:700;color:#0f172a}
    .hdr p{color:#64748b;margin-top:.4rem;font-size:.95rem}
    .back{display:inline-flex;align-items:center;gap:.35rem;font-size:.85rem;color:#64748b;text-decoration:none;margin-bottom:1.5rem;transition:color .15s}
    .back:hover{color:#0f172a}
    .window-label{font-size:.8rem;color:#94a3b8;margin-top:.35rem}
    .sec-label{font-size:.72rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem;margin-top:2rem}
    .month-group{margin-bottom:1.5rem}
    .month-hdr{font-size:.8rem;font-weight:600;color:#64748b;padding:.4rem 0;margin-bottom:.5rem;display:flex;align-items:center;gap:.75rem;cursor:pointer;user-select:none}
    .month-hdr:hover{color:#374151}
    .month-hdr::after{content:'';flex:1;height:1px;background:#e2e8f0}
    .chevron{display:inline-block;font-size:.65rem;color:#94a3b8;transition:transform .2s;order:1;margin-left:-.25rem}
    .month-group.collapsed .chevron{transform:rotate(-90deg)}
    .month-group.collapsed .month-body{display:none}
    .iitem{display:flex;justify-content:space-between;align-items:flex-start;padding:.875rem 1.25rem;background:white;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:.5rem}
    .iheader{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem}
    .iname{font-size:.875rem;font-weight:500;color:#0f172a}
    .ireason{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap}
    .idur{font-size:.8rem;color:#64748b;margin-top:.25rem}
    .itime{font-size:.8rem;color:#94a3b8;white-space:nowrap;text-align:right;flex-shrink:0;padding-left:1rem}
    .ongoing{color:#dc2626;font-weight:500}
    .all-clear{display:flex;align-items:center;gap:.75rem;padding:1rem 1.25rem;border-radius:10px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-weight:600;font-size:.95rem;margin-top:1rem}
    .footer{margin-top:3rem;text-align:center;font-size:.75rem;color:#cbd5e1}
    .loading{text-align:center;padding:4rem;color:#94a3b8}
    .err{text-align:center;padding:4rem;color:#ef4444}
    @media(max-width:520px){.iheader{display:block}.ireason{margin-top:.2rem}.iitem{flex-direction:column;gap:.35rem}.itime{text-align:left;padding-left:0}}
  </style>
</head>
<body>
<div class="container">
  <a href="${statusHref}" class="back">&#8592; Back to status</a>
  <div id="root"><div class="loading">Loading&hellip;</div></div>
</div>
<script>
  const SLUG = ${JSON.stringify(slug)};

  function dur(s) {
    if (!s || s < 0) return '';
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
    return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function fmtDate(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }

  function monthKey(ts) {
    const d = new Date(ts * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(key) {
    const [y, m] = key.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString('en', { month: 'long', year: 'numeric' });
  }

  const HTTP_DESC = {
    400:'Bad request',401:'Unauthorized',403:'Forbidden',404:'Not found',
    408:'Request timeout',429:'Too many requests',499:'Client closed request',
    500:'Internal server error',502:'Bad gateway',503:'Service unavailable',
    504:'Gateway timeout',521:'Web server down',522:'Connection timed out',
    523:'Origin unreachable',524:'Request timed out',525:'SSL handshake failed',
    526:'Invalid SSL certificate',530:'DNS error',
  };

  function reasonHtml(i) {
    if (i.trigger_status_code) {
      const desc = HTTP_DESC[i.trigger_status_code];
      return '<span style="background:#fee2e2;color:#991b1b;font-size:.7rem;padding:.15rem .45rem;border-radius:4px;font-weight:500">HTTP&nbsp;' + i.trigger_status_code + '</span>' +
        (desc ? '<span style="color:#64748b;font-size:.8rem">' + desc + '</span>' : '');
    }
    if (i.trigger_error) {
      const isTimeout = /timeout|timed?\\s*out/i.test(i.trigger_error);
      return '<span style="background:#f1f5f9;color:#64748b;font-size:.7rem;padding:.15rem .45rem;border-radius:4px">' + (isTimeout ? 'Timeout' : 'Error') + '</span>' +
        (!isTimeout ? '<span style="color:#64748b;font-size:.8rem">' + esc(i.trigger_error.slice(0, 80)) + '</span>' : '');
    }
    return '';
  }

  function toggleMonth(hdr) {
    hdr.closest('.month-group').classList.toggle('collapsed');
  }

  async function load() {
    try {
      const res = await fetch('/status/' + SLUG + '/history/data');
      if (!res.ok) throw new Error();
      render(await res.json());
    } catch {
      document.getElementById('root').innerHTML = '<div class="err">History not found.</div>';
    }
  }

  const SEV_STYLE = {
    info:     'background:#eff6ff;color:#1d4ed8',
    warning:  'background:#fffbeb;color:#92400e',
    critical: 'background:#fef2f2;color:#991b1b',
  };

  function monthGroups(items, keyFn) {
    const groups = {};
    items.forEach(x => {
      const k = monthKey(keyFn(x));
      if (!groups[k]) groups[k] = [];
      groups[k].push(x);
    });
    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(k => ({ k, items: groups[k] }));
  }

  function renderMonthSection(groupedItems, rowFn) {
    return groupedItems.map(({ k, items }) =>
      '<div class="month-group">' +
      '<div class="month-hdr" onclick="toggleMonth(this)">' +
      monthLabel(k) + ' <span class="chevron">&#9660;</span>' +
      '</div>' +
      '<div class="month-body">' + items.map(rowFn).join('') + '</div>' +
      '</div>'
    ).join('');
  }

  function render(data) {
    const { page, incidents, notices, window_days } = data;
    document.title = esc(page.name) + ' — History';

    let html = '<div class="hdr">' +
      (page.logo_url ? '<img src="' + esc(page.logo_url) + '" alt="' + esc(page.name) + '" style="height:48px;max-width:200px;object-fit:contain;display:block;margin-bottom:.75rem">' : '') +
      '<h1>' + esc(page.name) + '</h1>' +
      (page.description ? '<p>' + esc(page.description) + '</p>' : '') +
      '<div class="window-label">Incident &amp; notice history &mdash; past ' + window_days + ' days</div>' +
      '</div>';

    // ── Notices ───────────────────────────────────────────────────────────────
    if (notices && notices.length) {
      html += '<div class="sec-label">' + notices.length + ' notice' + (notices.length === 1 ? '' : 's') + '</div>';
      html += renderMonthSection(
        monthGroups(notices, n => n.created_at),
        n => {
          const style = SEV_STYLE[n.severity] || SEV_STYLE.info;
          const badge = '<span style="' + style + ';font-size:.7rem;padding:.15rem .45rem;border-radius:4px;font-weight:500;text-transform:capitalize">' + esc(n.severity) + '</span>';
          const status = n.resolved_at
            ? 'Resolved after ' + dur(n.resolved_at - n.created_at)
            : '<span class="ongoing">Still active</span>';
          return '<div class="iitem">' +
            '<div style="flex:1;min-width:0">' +
            '<div class="iheader">' +
            '<div class="iname">' + esc(n.message) + '</div>' +
            '<div class="ireason">' + badge + '</div>' +
            '</div>' +
            '<div class="idur">' + status + '</div>' +
            '</div>' +
            '<div class="itime">' + fmtDate(n.created_at) + '</div>' +
            '</div>';
        }
      );
    }

    // ── Incidents ─────────────────────────────────────────────────────────────
    if (!incidents.length) {
      html += '<div class="all-clear">&#9989;&nbsp; No incidents in the past ' + window_days + ' days</div>';
    } else {
      html += '<div class="sec-label" style="margin-top:2.5rem">' + incidents.length + ' incident' + (incidents.length === 1 ? '' : 's') + '</div>';
      html += renderMonthSection(
        monthGroups(incidents, i => i.started_at),
        i => {
          const reason = reasonHtml(i);
          const d = i.resolved_at
            ? 'Lasted ' + dur(i.resolved_at - i.started_at)
            : '<span class="ongoing">Ongoing</span>';
          return '<div class="iitem">' +
            '<div style="flex:1;min-width:0">' +
            '<div class="iheader">' +
            '<div class="iname">' + esc(i.monitor_name) + ' was down</div>' +
            (reason ? '<div class="ireason">' + reason + '</div>' : '') +
            '</div>' +
            '<div class="idur">' + d + '</div>' +
            '</div>' +
            '<div class="itime">' + fmtDate(i.started_at) + '</div>' +
            '</div>';
        }
      );
    }

    html += '<div class="footer">Last updated ' + new Date(data.generated_at).toUTCString() + '</div>';
    document.getElementById('root').innerHTML = html;
  }

  load();
</script>
</body>
</html>`;
}
