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
    .hdr-logo{width:38px;height:38px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.95rem;letter-spacing:-.02em}
    /* .hdr-inner re-applies .container's max-width+padding inside a full-bleed band
       (.hdr-banner / .hdr-navbar), so the logo/title still lines up with the services
       list below even though the background spans the whole page width. */
    .hdr-inner{max-width:760px;margin:0 auto;padding:0 1.5rem}
    .hdr-banner{background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(0,0,0,.14)),var(--brand,var(--accent));color:var(--brand-text,#fff);padding:1.75rem 0;margin-bottom:2.5rem}
    .hdr-banner .row{display:flex;align-items:center;gap:.85rem}
    .hdr-banner .hdr-logo{background:rgba(255,255,255,.22)}
    .hdr-banner h1{font-size:1.5rem;font-weight:700;line-height:1.2;color:inherit}
    .hdr-banner p{font-size:.85rem;margin-top:.15rem;opacity:.85;color:inherit}
    .hdr-compact{display:flex;align-items:center;gap:.7rem;padding-bottom:.9rem;margin-bottom:2.5rem;border-bottom:2px solid var(--brand,var(--accent))}
    .hdr-compact .hdr-logo{background:var(--brand,var(--accent));color:#fff}
    .hdr-compact .meta{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}
    .hdr-compact h1{font-size:1.15rem;color:var(--heading)}
    .hdr-compact p{font-size:.8rem;color:var(--text-faint);margin-top:0}
    /* Fixed dark navy regardless of theme, with a hairline + shadow seam so it stays
       visibly distinct from the page background in dark mode too. */
    .hdr-navbar{background:#1b2140;padding:1.25rem 0 3.4rem;border-bottom:1px solid rgba(148,163,184,.22);box-shadow:0 8px 20px -8px rgba(0,0,0,.45)}
    .navbar-top{display:flex;align-items:center;gap:1rem}
    .navbar-brand{display:flex;align-items:center;gap:.65rem;color:#fff;flex:1;min-width:0}
    .navbar-brand .hdr-logo{background:rgba(255,255,255,.16);color:#fff}
    .navbar-title{font-weight:700;font-size:1.05rem;line-height:1.25}
    .navbar-subtitle{font-size:.78rem;color:rgba(255,255,255,.6);margin-top:.1rem}
    .navbar-right{text-align:right;margin-right:.9rem}
    .navbar-status-label{font-size:.82rem;font-weight:700;color:#fff}
    .navbar-meta{font-size:.72rem;color:rgba(255,255,255,.55);margin-top:.15rem;font-variant-numeric:tabular-nums}
    .navbar-bell{width:2.15rem;height:2.15rem;border-radius:8px;flex:none;background:var(--brand,var(--accent));color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none}
    @media(max-width:520px){.navbar-right{display:none}}
    .container-flush{padding-top:0}
    .overall{display:flex;align-items:center;gap:.75rem;padding:1rem 1.25rem;border-radius:10px;margin-bottom:2rem;font-weight:600;font-size:.95rem;transition:margin .15s}
    /* Navbar re-skins this same dynamic status banner into a floating card instead of
       showing a second "all systems operational" line — one source, no duplication. */
    .overall-floating{margin:-2.15rem 0 1.75rem;box-shadow:0 12px 28px rgba(15,23,42,.16);position:relative;z-index:2}
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
    .s-degraded{background:var(--yellow-bg);color:var(--yellow-text)}
    .s-unknown{background:var(--bg);color:var(--text-faint)}
    .sdot{width:6px;height:6px;border-radius:50%}
    .sdot-up{background:#22c55e}.sdot-down{background:#ef4444}.sdot-degraded{background:#f59e0b}.sdot-unknown{background:#94a3b8}
    .uptime-bar{display:flex;gap:1.5px;height:28px;align-items:stretch}
    .bkt{flex:1;border-radius:2px;cursor:default}
    .bkt:hover{opacity:.7}
    .bkt-up{background:#86efac}.bkt-down{background:#fca5a5}.bkt-degraded{background:#fde68a}.bkt-unknown{background:var(--border)}
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
<div id="header-root"></div>
<div class="container" id="bodyContainer">
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

  function initials(name) {
    return (name || '').trim().split(/\\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  }

  function contrastText(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return luminance > 0.42 ? '#1a1a1a' : '#fff';
  }

  function applyBrandColor(page) {
    const root = document.documentElement;
    const brand = page.brand_color && /^#[0-9a-fA-F]{6}$/.test(page.brand_color) ? page.brand_color : null;
    if (brand) {
      root.style.setProperty('--brand', brand);
      root.style.setProperty('--brand-text', contrastText(brand));
    } else {
      root.style.removeProperty('--brand');
      root.style.removeProperty('--brand-text');
    }
  }

  function logoHtml(page, extraClass) {
    if (page.logo_url) {
      return '<img class="' + extraClass + '" src="' + esc(page.logo_url) + '" alt="' + esc(page.name) + '" style="height:38px;max-width:120px;object-fit:contain;border-radius:6px">';
    }
    return '<div class="hdr-logo ' + extraClass + '">' + esc(initials(page.name)) + '</div>';
  }

  let lastLoadedAt = null;
  let nextLoadAt = null;

  function formatClock(date) {
    const h = date.getHours() % 12 || 12;
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return h + ':' + mm + ':' + ss + ' ' + ampm;
  }

  function tickNavbarMeta() {
    const el = document.getElementById('navbarMeta');
    if (!el || !lastLoadedAt || !nextLoadAt) return;
    const secsLeft = Math.max(0, Math.round((nextLoadAt - Date.now()) / 1000));
    el.textContent = 'Last updated ' + formatClock(lastLoadedAt) + ' | Next update in ' + secsLeft + ' sec.';
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
    let data;
    try {
      const res = await fetch('/status/' + SLUG + '/data');
      if (!res.ok) throw new Error('not found');
      data = await res.json();
    } catch {
      document.getElementById('root').innerHTML = '<div class="err">Status page not found.</div>';
      return;
    }

    try {
      render(data);
    } catch (err) {
      console.error('Failed to render status page:', err);
      document.getElementById('root').innerHTML = '<div class="err">Something went wrong loading this page. Please refresh.</div>';
    }
  }

  function render(data) {
    const { page, monitors, notices } = data;

    const anyDown = monitors.some(m => m.current_status === 'down');
    const anyDegraded = monitors.some(m => m.current_status === 'degraded');
    const allUp = monitors.length > 0 && monitors.every(m => m.current_status === 'up');
    const ovClass = anyDown ? 'has-issues' : (anyDegraded ? 'partial' : (allUp ? 'all-good' : 'partial'));
    const ovIcon = anyDown ? '&#128308;' : anyDegraded ? '&#9888;&#65039;' : allUp ? '&#9989;' : '&#9888;&#65039;';
    const ovText = anyDown ? 'Some systems are experiencing issues'
      : anyDegraded ? 'Some systems are degraded'
      : allUp ? 'All systems operational'
      : 'Checking systems&hellip;';

    const items = monitors.map(m => {
      const sc = 's-' + m.current_status;
      const dc = 'sdot-' + m.current_status;
      const sl = m.current_status === 'up' ? 'Operational' : m.current_status === 'down' ? 'Down' : m.current_status === 'degraded' ? 'Degraded' : 'No data';
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

    applyBrandColor(page);
    lastLoadedAt = new Date(data.generated_at);
    nextLoadAt = Date.now() + 60000;

    const desc = page.description ? '<p>' + esc(page.description) + '</p>' : '';
    const isNavbar = page.header_template === 'navbar';
    let hdrHtml = '';
    let headerFullHtml = '';

    if (page.header_template === 'banner') {
      headerFullHtml = '<div class="hdr hdr-banner"><div class="hdr-inner"><div class="row">' + logoHtml(page, '') +
        '<div><h1>' + esc(page.name) + '</h1>' + desc + '</div></div></div></div>';
    } else if (isNavbar) {
      const navbarSubtitle = page.description ? '<div class="navbar-subtitle">' + esc(page.description) + '</div>' : '';
      headerFullHtml = '<div class="hdr-navbar"><div class="hdr-inner"><div class="navbar-top">' +
        '<div class="navbar-brand">' + logoHtml(page, '') +
          '<div><div class="navbar-title">' + esc(page.name) + '</div>' + navbarSubtitle + '</div>' +
        '</div>' +
        '<div class="navbar-right">' +
          '<div class="navbar-status-label">Service status</div>' +
          '<div class="navbar-meta" id="navbarMeta"></div>' +
        '</div>' +
        '<a class="navbar-bell" href="${rssHref}" target="_blank" rel="noopener" title="Subscribe via RSS" aria-label="Subscribe via RSS">&#128276;</a>' +
        '</div></div></div>';
    } else if (page.header_template === 'compact') {
      hdrHtml = '<div class="hdr hdr-compact">' + logoHtml(page, '') +
        '<div class="meta"><h1>' + esc(page.name) + '</h1>' + desc + '</div></div>';
    } else {
      hdrHtml = '<div class="hdr">' +
        (page.logo_url ? '<img src="' + esc(page.logo_url) + '" alt="' + esc(page.name) + '" style="height:48px;max-width:200px;object-fit:contain;display:block;margin-bottom:.75rem">' : '') +
        '<h1>' + esc(page.name) + '</h1>' + desc + '</div>';
    }

    document.getElementById('header-root').innerHTML = headerFullHtml;
    document.getElementById('bodyContainer').classList.toggle('container-flush', isNavbar);

    // In Navbar, the status banner overlaps the bar itself, so it has to be the
    // first thing after the header — not the notice list — or its negative
    // margin pulls it into whatever notice happens to be on top instead.
    const overallHtml = '<div class="overall ' + ovClass + (isNavbar ? ' overall-floating' : '') + '">' + ovIcon + '&nbsp;' + ovText + '</div>';

    document.title = esc(page.name) + ' — Status';
    document.getElementById('root').innerHTML =
      hdrHtml +
      (isNavbar ? overallHtml + noticeHtml : noticeHtml + overallHtml) +
      '<div style="margin-bottom:2rem"><div class="sec-label">Services</div>' + items + '</div>' +
      '<div class="incidents-sec"><div class="sec-label" style="display:flex;justify-content:space-between;align-items:center">Past Incidents<a href="${historyHref}" style="font-size:.75rem;color:var(--brand,var(--text-faint));text-decoration:none;font-weight:400;text-transform:none;letter-spacing:0">View full history &rarr;</a></div>' + incidents + '</div>' +
      '<div class="footer">Last updated ' + new Date(data.generated_at).toUTCString() + ' &nbsp;&middot;&nbsp; <a href="${rssHref}" style="color:var(--brand,var(--text-faint));text-decoration:none" title="Subscribe via RSS">RSS feed</a></div>' +
      '<div class="footer" style="margin-top:.75rem;display:flex;align-items:center;justify-content:center;gap:.4rem">' +
        'Hosted for free using' +
        '&nbsp;<a href="https://cloudflare-uptime.andrs.nu" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:.35rem;color:var(--text-faint);text-decoration:none;font-weight:500">' +
          '<img src="https://cloudflare-uptime.andrs.nu/logo.png" alt="" height="24" style="display:block;border-radius:4px">' +
          'Cloudflare Uptime' +
        '</a>' +
      '</div>';

    tickNavbarMeta();
  }

  load();
  setInterval(load, 60000);
  setInterval(tickNavbarMeta, 1000);
</script>
${themeBodyScript()}
</body>
</html>`;
}
