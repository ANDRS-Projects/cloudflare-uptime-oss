const SVG_SUN = `<svg id="icon-sun" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const SVG_MOON = `<svg id="icon-moon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function themeHeadScript(): string {
  return `<script>(function(){var s=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',s==='dark'||(!s&&d)?'dark':'light');})();</script>`;
}

export function themeCssVars(): string {
  return `
    :root{
      --bg:#f8fafc;--surface:#fff;--border:#e2e8f0;--border-faint:#f1f5f9;
      --text:#1e293b;--text-muted:#64748b;--text-faint:#94a3b8;--heading:#0f172a;
      --accent:#3b82f6;
      --green:#16a34a;--green-bg:#f0fdf4;--green-border:#bbf7d0;
      --red-bg:#fef2f2;--red-text:#991b1b;--red-border:#fecaca;
      --yellow-bg:#fffbeb;--yellow-text:#92400e;--yellow-border:#fde68a;
      --blue-bg:#eff6ff;--blue-text:#1d4ed8;--blue-border:#bfdbfe;
      --sidebar:#1e293b;--sidebar-hover:#334155;
      --input-border:#d1d5db;--row-down-bg:#fff8f8;
    }
    @media(prefers-color-scheme:dark){:root:not([data-theme=light]){
      --bg:#0f172a;--surface:#1e293b;--border:#334155;--border-faint:#243347;
      --text:#e2e8f0;--text-muted:#94a3b8;--text-faint:#64748b;--heading:#f1f5f9;
      --accent:#60a5fa;
      --green:#22c55e;--green-bg:#052e16;--green-border:#14532d;
      --red-bg:#2d1515;--red-text:#fca5a5;--red-border:#7f1d1d;
      --yellow-bg:#2d2000;--yellow-text:#fcd34d;--yellow-border:#92400e;
      --blue-bg:#0c1a2e;--blue-text:#93c5fd;--blue-border:#1e40af;
      --sidebar:#020617;--sidebar-hover:#0f172a;
      --input-border:#334155;--row-down-bg:#1a0a0a;
    }}
    [data-theme=dark]{
      --bg:#0f172a;--surface:#1e293b;--border:#334155;--border-faint:#243347;
      --text:#e2e8f0;--text-muted:#94a3b8;--text-faint:#64748b;--heading:#f1f5f9;
      --accent:#60a5fa;
      --green:#22c55e;--green-bg:#052e16;--green-border:#14532d;
      --red-bg:#2d1515;--red-text:#fca5a5;--red-border:#7f1d1d;
      --yellow-bg:#2d2000;--yellow-text:#fcd34d;--yellow-border:#92400e;
      --blue-bg:#0c1a2e;--blue-text:#93c5fd;--blue-border:#1e40af;
      --sidebar:#020617;--sidebar-hover:#0f172a;
      --input-border:#334155;--row-down-bg:#1a0a0a;
    }
    [data-theme=light]{
      --bg:#f8fafc;--surface:#fff;--border:#e2e8f0;--border-faint:#f1f5f9;
      --text:#1e293b;--text-muted:#64748b;--text-faint:#94a3b8;--heading:#0f172a;
      --accent:#3b82f6;
      --green:#16a34a;--green-bg:#f0fdf4;--green-border:#bbf7d0;
      --red-bg:#fef2f2;--red-text:#991b1b;--red-border:#fecaca;
      --yellow-bg:#fffbeb;--yellow-text:#92400e;--yellow-border:#fde68a;
      --blue-bg:#eff6ff;--blue-text:#1d4ed8;--blue-border:#bfdbfe;
      --sidebar:#1e293b;--sidebar-hover:#334155;
      --input-border:#d1d5db;--row-down-bg:#fff8f8;
    }`;
}

export function themeToggleBtn(extraStyle = ''): string {
  return `<button onclick="toggleTheme()" aria-label="Toggle theme" style="background:none;border:none;cursor:pointer;padding:.3rem;color:var(--text-faint);display:inline-flex;align-items:center${extraStyle ? ';' + extraStyle : ''}">${SVG_SUN}${SVG_MOON}</button>`;
}

export function themeBodyScript(): string {
  return `<script>
  (function(){
    var dark=document.documentElement.getAttribute('data-theme')==='dark';
    document.getElementById('icon-sun').style.display=dark?'block':'none';
    document.getElementById('icon-moon').style.display=dark?'none':'block';
  })();
  function toggleTheme(){
    var next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    document.getElementById('icon-sun').style.display=next==='dark'?'block':'none';
    document.getElementById('icon-moon').style.display=next==='dark'?'none':'block';
    localStorage.setItem('theme',next);
  }
</script>`;
}
