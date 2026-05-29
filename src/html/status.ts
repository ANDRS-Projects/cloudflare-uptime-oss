import { themeHeadScript, themeCssVars, themeToggleBtn, themeBodyScript } from './theme.js';

export function renderStatusPage(slug: string, isCustomDomain = false): string {
  const historyHref = isCustomDomain ? '/history' : `/status/${slug}/history`;
  const rssHref = isCustomDomain ? '/rss' : `/status/${slug}/rss`;
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Status</title>
  <link rel="alternate" type="application/rss+xml" title="Status feed" href="${rssHref}">
  ${themeHeadScript()}
  <style>
    ${themeCssVars()}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text)}
    .container{max-width:760px;margin:0 auto;padding:3rem 1.5rem}
    .hdr{margin-bottom:2.5rem}
    .hdr h1{font-size:1.75rem;font-weight:700;color:var(--heading)}
    .hdr p{color:var(--text-muted);margin-top:.4rem;font-size:.95rem}
    .overall{display:flex;align-items:center;gap:.75rem;padding:1rem 1.25rem;border-radius:10px;margin-bottom:2rem;font-weight:600;font-size:.95rem}
    .notice{padding:.875rem 1.25rem;border-radius:8px;margin-bottom:.625rem;border:1px solid}
    .notice-info{background:var(--blue-bg);color:var(--blue-text);border-color:var(--blue-border)}
    .notice-warning{background:var(--yellow-bg);color:var(--yellow-text);border-color:var(--yellow-border)}
    .notice-critical{background:var(--red-bg);color:var(--red-text);border-color:var(--red-border)}
    .notice-resolved{background:var(--bg);color:var(--text-muted);border-color:var(--border)}
    .notice-msg{font-size:.875rem;font-weight:500;line-height:1.4}
    .notice-meta{font-size:.75rem;opacity:.65;margin-top:.25rem}
    .resolved-badge{display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:600;background:var(--green-bg);color:var(--green);padding:.1rem .4rem;border-radius:4px;margin-left:.5rem;vertical-align:middle}
    .all-good{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border)}
    .has-issues{background:var(--red-bg);color:var(--red-text);border:1px solid var(--red-border)}
    .partial{background:var(--yellow-bg);color:var(--yellow-text);border:1px solid var(--yellow-border)}
    .sec-label{font-size:.72rem;font-weight:600;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.75rem}
    .mitem{background:var(--surface);border-radius:8px;border:1px solid var(--border);padding:1rem 1.25rem;margin-bottom:.5rem}
    .mtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:.65rem}
    .mname{font-weight:500;font-size:.9rem}
    .mmeta{display:flex;align-items:center;gap:.875rem}
    @media(max-width:520px){.mtop{flex-direction:column;align-items:flex-start;gap:.4rem}.mmeta{flex-wrap:wrap;gap:.5rem}}
    .sbadge{display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;font-weight:500;padding:.2rem .6rem;border-radius:20px}
    .s-up{background:var(--green-bg);color:var(--green)}
    .s-down{background:var(--red-bg);color:var(--red-text)}
    .s-unknown{background:var(--bg);color:var(--text-faint)}
    .sdot{width:6px;height:6px;border-radius:50%}
    .sdot-up{background:#22c55e}.sdot-down{background:#ef4444}.sdot-unknown{background:#94a3b8}
    .uptime-bar{display:flex;gap:1.5px;height:28px;align-items:stretch}
    .bkt{flex:1;border-radius:2px;cursor:default}
    .bkt:hover{opacity:.7}
    .bkt-up{background:#86efac}.bkt-down{background:#fca5a5}.bkt-unknown{background:var(--border)}
    .bar-foot{display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-faint);margin-top:.35rem}
    .graph-wrap{margin-top:.75rem}
    .graph-label{font-size:.7rem;color:var(--text-faint);margin-bottom:.2rem}
    .graph-foot{display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-faint);margin-top:.2rem}
    .upct{font-size:.8rem;color:var(--text-muted);font-weight:500;white-space:nowrap}
    .lat{font-size:.8rem;color:var(--text-faint)}
    .incidents-sec{margin-top:2.5rem}
    .iitem{display:flex;justify-content:space-between;align-items:flex-start;padding:.875rem 1.25rem;background:var(--surface);border-radius:8px;border:1px solid var(--border);margin-bottom:.5rem}
    .iheader{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem}
    .iname{font-size:.875rem;font-weight:500;color:var(--heading)}
    .ireason{display:flex;align-items:center;gap:.35rem;flex-wrap:wrap}
    .idur{font-size:.8rem;color:var(--text-muted);margin-top:.2rem}
    @media(max-width:520px){.iheader{display:block}.ireason{margin-top:.2rem}}
    .itime{font-size:.8rem;color:var(--text-faint);white-space:nowrap}
    .ongoing{color:#dc2626;font-weight:500}
    .footer{margin-top:3rem;text-align:center;font-size:.75rem;color:var(--text-faint)}
    .loading{text-align:center;padding:4rem;color:var(--text-faint)}
    .err{text-align:center;padding:4rem;color:#ef4444}
    .theme-btn{position:fixed;top:.75rem;right:.75rem;z-index:10}
  </style>
</head>
<body>
<div class="theme-btn">${themeToggleBtn()}</div>
<div class="container">
  <div id="root"><div class="loading">Loading&hellip;</div></div>
</div>
<script>
  const SLUG = ${JSON.stringify(slug)};

  function ago(ts) {
    const s = Math.floor(Date.now() / 1000) - ts;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function dur(s) {
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
    return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function latencyGraph(buckets) {
    if (!buckets || !buckets.length) return '';
    const valid = buckets.filter(b => b.avg_ms !== null);
    if (valid.length < 2) return '';
    const W = 300, H = 44;
    const maxMs = Math.max(...valid.map(b => b.avg_ms));
    const downBars = buckets.map((b, i) => {
      if (b.ok) return '';
      const x = (i / 24) * W;
      return '<rect x="' + x.toFixed(1) + '" y="0" width="' + (W / 24 + 0.5).toFixed(1) + '" height="' + H + '" fill="#fca5a5" opacity="0.5"/>';
    }).join('');
    const segs = [];
    let seg = '';
    buckets.forEach((b, i) => {
      const x = ((i + 0.5) / 24) * W;
      if (b.avg_ms === null) { if (seg) { segs.push(seg); seg = ''; } return; }
      const y = Math.max(2, (H - 4) - (b.avg_ms / maxMs) * (H - 8));
      seg += (seg ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    if (seg) segs.push(seg);
    const lines = segs.map(s => '<path d="' + s + '" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>').join('');
    const maxLabel = maxMs >= 1000 ? (maxMs / 1000).toFixed(1) + 's' : maxMs + 'ms';
    return '<div class="graph-wrap">' +
      '<div class="graph-label">Response time &mdash; last 24h &nbsp;<span style="color:var(--heading);font-weight:500">max ' + maxLabel + '</span></div>' +
      '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="display:block;background:var(--bg);border-radius:4px;overflow:hidden">' +
      downBars + lines + '</svg>' +
      '<div class="graph-foot"><span>24h ago</span><span>Now</span></div>' +
      '</div>';
  }

  function bar(buckets) {
    const bkts = buckets.map(b => '<div class="bkt bkt-' + b + '" title="' + b + '"></div>').join('');
    return '<div class="uptime-bar">' + bkts + '</div>' +
      '<div class="bar-foot"><span>30 days ago</span><span>Today</span></div>';
  }

  async function load() {
    try {
      const res = await fetch('/status/' + SLUG + '/data');
      if (!res.ok) throw new Error();
      render(await res.json());
    } catch {
      document.getElementById('root').innerHTML = '<div class="err">Status page not found.</div>';
    }
  }

  function render(data) {
    const { page, monitors, notices } = data;

    const anyDown = monitors.some(m => m.current_status === 'down');
    const allUp = monitors.length > 0 && monitors.every(m => m.current_status === 'up');
    const ovClass = anyDown ? 'has-issues' : allUp ? 'all-good' : 'partial';
    const ovIcon = anyDown ? '&#128308;' : allUp ? '&#9989;' : '&#9888;&#65039;';
    const ovText = anyDown ? 'Some systems are experiencing issues'
      : allUp ? 'All systems operational'
      : 'Checking systems&hellip;';

    const items = monitors.map(m => {
      const sc = 's-' + m.current_status;
      const dc = 'sdot-' + m.current_status;
      const sl = m.current_status === 'up' ? 'Operational' : m.current_status === 'down' ? 'Down' : 'No data';
      return '<div class="mitem">' +
        '<div class="mtop">' +
        '<span class="mname">' + esc(m.name) + '</span>' +
        '<div class="mmeta">' +
        (m.latency_ms != null ? '<span class="lat">' + m.latency_ms + 'ms</span>' : '') +
        '<span class="upct">' + m.uptime_30d + '% uptime</span>' +
        '<span class="sbadge ' + sc + '"><span class="sdot ' + dc + '"></span>' + sl + '</span>' +
        '</div></div>' +
        bar(m.buckets) +
        latencyGraph(m.latency_24h) +
        '</div>';
    }).join('') || '<div style="color:var(--text-faint);font-size:.875rem">No services configured.</div>';

    const allIncidents = monitors.flatMap(m =>
      (m.incidents || []).map(i => ({ ...i, monitor_name: m.name }))
    ).sort((a, b) => b.started_at - a.started_at).slice(0, 10);

    const HTTP_DESC = {
      400:'Bad request',401:'Unauthorized',403:'Forbidden',404:'Not found',
      408:'Request timeout',429:'Too many requests',499:'Client closed request',
      500:'Internal server error',502:'Bad gateway',503:'Service unavailable',
      504:'Gateway timeout',521:'Web server down',522:'Connection timed out',
      523:'Origin unreachable',524:'Request timed out',525:'SSL handshake failed',
      526:'Invalid SSL certificate',530:'DNS error',
    };

    const incidents = allIncidents.length ? allIncidents.map(i => {
      const d = i.resolved_at ? 'Lasted ' + dur(i.resolved_at - i.started_at) : '<span class="ongoing">Ongoing</span>';
      let reason = '';
      if (i.trigger_status_code) {
        const desc = HTTP_DESC[i.trigger_status_code];
        reason = '<span style="background:var(--red-bg);color:var(--red-text);font-size:.7rem;padding:.15rem .45rem;border-radius:4px;font-weight:500">HTTP&nbsp;' + i.trigger_status_code + '</span>' +
          (desc ? '<span style="color:var(--text-muted);font-size:.8rem">' + desc + '</span>' : '');
      } else if (i.trigger_error) {
        const isTimeout = /timeout|timed?\s*out/i.test(i.trigger_error);
        reason = '<span style="background:var(--border-faint);color:var(--text-muted);font-size:.7rem;padding:.15rem .45rem;border-radius:4px">' + (isTimeout ? 'Timeout' : 'Error') + '</span>' +
          (!isTimeout ? '<span style="color:var(--text-muted);font-size:.8rem">' + esc(i.trigger_error.slice(0, 80)) + '</span>' : '');
      }
      return '<div class="iitem">' +
        '<div>' +
        '<div class="iheader">' +
        '<div class="iname">' + esc(i.monitor_name) + ' was down</div>' +
        (reason ? '<div class="ireason">' + reason + '</div>' : '') +
        '</div>' +
        '<div class="idur">' + d + '</div>' +
        '</div>' +
        '<div class="itime">' + ago(i.started_at) + '</div>' +
        '</div>';
    }).join('') : '<div style="color:var(--text-faint);font-size:.875rem;padding:.5rem 0">No incidents recorded.</div>';

    const noticeHtml = (notices || []).length
      ? '<div style="margin-bottom:1.5rem">' +
        (notices || []).map(n => {
          const resolved = !!n.resolved_at;
          const cls = resolved ? 'notice-resolved' : 'notice-' + n.severity;
          const badge = resolved ? '<span class="resolved-badge">&#10003; Resolved</span>' : '';
          const meta = ago(n.created_at) + (resolved ? ' &middot; resolved ' + ago(n.resolved_at) : '');
          return '<div class="notice ' + cls + '">' +
            '<div class="notice-msg">' + esc(n.message) + badge + '</div>' +
            '<div class="notice-meta">' + meta + '</div>' +
            '</div>';
        }).join('') + '</div>'
      : '';

    document.title = esc(page.name) + ' — Status';
    document.getElementById('root').innerHTML =
      '<div class="hdr">' +
      (page.logo_url ? '<img src="' + esc(page.logo_url) + '" alt="' + esc(page.name) + '" style="height:48px;max-width:200px;object-fit:contain;display:block;margin-bottom:.75rem">' : '') +
      '<h1>' + esc(page.name) + '</h1>' +
      (page.description ? '<p>' + esc(page.description) + '</p>' : '') + '</div>' +
      noticeHtml +
      '<div class="overall ' + ovClass + '">' + ovIcon + '&nbsp;' + ovText + '</div>' +
      '<div style="margin-bottom:2rem"><div class="sec-label">Services</div>' + items + '</div>' +
      '<div class="incidents-sec"><div class="sec-label" style="display:flex;justify-content:space-between;align-items:center">Past Incidents<a href="${historyHref}" style="font-size:.75rem;color:var(--text-faint);text-decoration:none;font-weight:400;text-transform:none;letter-spacing:0">View full history &rarr;</a></div>' + incidents + '</div>' +
      '<div class="footer">Last updated ' + new Date(data.generated_at).toUTCString() + ' &nbsp;&middot;&nbsp; <a href="${rssHref}" style="color:var(--text-faint);text-decoration:none" title="Subscribe via RSS">RSS feed</a></div>';
  }

  load();
  setInterval(load, 60000);
</script>
${themeBodyScript()}
</body>
</html>`;
}
