// lib/render/admin.ts
//
// Toma el markup estatico de content/admin.ts e inyecta los datos reales
// del dashboard ANTES de renderizar, preservando el diseno por completo.
//
// IMPORTANTE: todos los reemplazos usan una FUNCION de reemplazo en vez de
// un string, porque los montos con "$" (ej. "$1.2k") chocan con los patrones
// $1, $2... que .replace() interpreta como grupos de captura. Con funcion,
// el "$" se inserta literal y nunca se corrompe el HTML.

import type { DashboardData } from '@/lib/queries/dashboard';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function money0(n: number): string {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function money2(n: number): string {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
// Formato compacto tipo "$2.6k" / "$340".
function kfmt(n: number): string {
  const v = Number(n || 0);
  return v >= 1000
    ? '$' + (v / 1000).toFixed(2).replace(/\.?0+$/, '') + 'k'
    : '$' + Math.round(v).toLocaleString('en-US');
}
function initials(name: string | null): string {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase() || '?'
  );
}
function fmtDate(d: string | null): string {
  if (!d) return '\u2014';
  const dt = new Date(d.slice(0, 10) + 'T00:00:00');
  if (isNaN(dt.getTime())) return '\u2014';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Paleta del donut: arranca con los colores del diseno y extiende si hace falta.
const DONUT_PALETTE = ['#10BEB2', '#0E9E95', '#7fd9d0', '#cdeee9', '#0b7d76', '#a7e3dc'];

export function renderAdminMarkup(markup: string, data: DashboardData): string {
  let out = markup;

  // ===================== KPIs =====================
  // Dos fases con tokens unicos para evitar colisiones: si un valor nuevo
  // (ej. totalClients=7) coincidiera con el ancla de otro KPI (data-count="7"),
  // un reemplazo posterior lo agarraria por error. Los tokens evitan eso.
  out = out
    .replace('data-count="38"', 'data-count="@@KPI_CLIENTS@@"')
    .replace('data-count="4280"', 'data-count="@@KPI_REVENUE@@"')
    .replace('data-count="620"', 'data-count="@@KPI_OUTSTANDING@@"')
    .replace('data-count="7"', 'data-count="@@KPI_LEADS@@"');
  out = out
    .replace('@@KPI_CLIENTS@@', String(data.totalClients))
    .replace('@@KPI_REVENUE@@', String(Math.round(data.monthlyRevenue)))
    .replace('@@KPI_OUTSTANDING@@', String(Math.round(data.outstanding)))
    .replace('@@KPI_LEADS@@', String(data.newLeads));

  // ===================== Sidebar badges =====================
  out = out.replace(
    'Tickets<span class="bd">5</span>',
    () => `Tickets${data.openTickets > 0 ? `<span class="bd">${data.openTickets}</span>` : ''}`
  );
  out = out.replace(
    'Leads<span class="bd">7</span>',
    () => `Leads${data.newLeads > 0 ? `<span class="bd">${data.newLeads}</span>` : ''}`
  );

  // ===================== Recent Payments (tbody) =====================
  const payRows = data.recentPayments.length
    ? data.recentPayments
        .map(
          (p) =>
            `<tr><td><div class="cl"><div class="av"></div>${esc(p.client_name)}</div></td><td>$${money2(p.amount)}</td><td>${esc(p.method || '\u2014')}</td><td><span class="st paid">Paid</span></td></tr>`
        )
        .join('')
    : `<tr><td colspan="4" style="color:var(--sub);padding:16px 8px">No payments yet</td></tr>`;
  out = out.replace(
    /(<th>Amount<\/th><th>Method<\/th><th>Status<\/th><\/tr><\/thead><tbody>)[\s\S]*?(<\/tbody>)/,
    (_m, g1, g2) => `${g1}${payRows}${g2}`
  );

  // ===================== Top Clients (tbody) =====================
  const topRows = data.topClients.length
    ? data.topClients
        .map(
          (c) =>
            `<tr><td><div class="cl"><div class="av"></div>${esc(c.company_name)}</div></td><td>${esc(c.service_name || '\u2014')}</td><td>$${money0(c.monthly)}</td><td><span class="st active">Active</span></td></tr>`
        )
        .join('')
    : `<tr><td colspan="4" style="color:var(--sub);padding:16px 8px">No clients yet</td></tr>`;
  out = out.replace(
    /(<th>Plan<\/th><th>Monthly<\/th><th>Status<\/th><\/tr><\/thead><tbody>)[\s\S]*?(<\/tbody>)/,
    (_m, g1, g2) => `${g1}${topRows}${g2}`
  );

  // ===================== New Leads (lista) =====================
  const leadLabel = `${data.newLeads} this week`;
  const leadsHtml = data.recentLeads.length
    ? data.recentLeads
        .map(
          (l) =>
            `<div class="lead"><div class="av">${esc(initials(l.name))}</div><div><div class="nm">${esc(l.name || '\u2014')}</div><div class="mt">${l.service_interest ? 'Wants: ' + esc(l.service_interest) : 'New inquiry'}</div></div><span class="tm">${fmtDate(l.created_at)}</span></div>`
        )
        .join('')
    : `<div class="lead" style="color:var(--sub)">No leads yet</div>`;
  out = out.replace(
    /(<h3>New Leads<span class="tag">)[^<]*(<\/span><\/h3>\s*)(?:<div class="lead">[\s\S]*?<\/span><\/div>\s*)+/,
    (_m, g1, g2) => `${g1}${leadLabel}${g2}${leadsHtml}`
  );

  // ===================== Upcoming Renewals (lista) =====================
  const renHtml = data.upcomingRenewals.length
    ? data.upcomingRenewals
        .map(
          (r) =>
            `<div class="ren"><span class="nm">${esc(r.client_name)}${r.service_name ? ' \u00b7 ' + esc(r.service_name) : ''}</span><span class="dt">${fmtDate(r.renewal_date)}</span></div>`
        )
        .join('')
    : `<div class="ren"><span class="nm" style="color:var(--sub)">No upcoming renewals</span></div>`;
  out = out.replace(
    /(<h3>Upcoming Renewals<\/h3>\s*)(?:<div class="ren">[\s\S]*?<\/div>\s*)+/,
    (_m, g1) => `${g1}${renHtml}`
  );

  // ===================== Revenue bars (6 meses) =====================
  let series = data.revenueSeries;
  if (!series || series.length === 0) {
    const now = new Date();
    series = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      series.push({ label: d.toLocaleString('en-US', { month: 'short' }), amount: 0 });
    }
  }
  const maxBar = Math.max(1, ...series.map((p) => p.amount));
  const barsHtml = series
    .map((p) => {
      const h = Math.round((p.amount / maxBar) * 100);
      return `<div class="bar"><div class="col" data-h="${h}"><span>${kfmt(p.amount)}</span></div><div class="m">${esc(p.label)}</div></div>`;
    })
    .join('');
  out = out.replace(
    /<div class="chart" id="chart">[\s\S]*?<\/div>\s*<\/div>\s*(<div class="card rv">\s*<h3>Recent Payments)/,
    (_m, g1) => `<div class="chart" id="chart">${barsHtml}</div>\n          </div>\n          ${g1}`
  );

  // ===================== Donut (Revenue by Service) =====================
  let slices = [...(data.revenueByService || [])].sort((a, b) => b.amount - a.amount);
  if (slices.length > 5) {
    const top = slices.slice(0, 4);
    const rest = slices.slice(4).reduce((s, x) => s + x.amount, 0);
    slices = [...top, { label: 'Other', amount: rest }];
  }
  const donutTotal = slices.reduce((s, x) => s + x.amount, 0);

  let gradient: string;
  let legend: string;
  if (donutTotal <= 0) {
    gradient = 'conic-gradient(#e5e7eb 0 100%)';
    legend =
      '<div><span class="sw" style="background:#e5e7eb"></span>No service revenue<span class="val">0%</span></div>';
  } else {
    let acc = 0;
    const stops: string[] = [];
    const items: string[] = [];
    slices.forEach((s, i) => {
      const c = DONUT_PALETTE[i % DONUT_PALETTE.length];
      const pct = (s.amount / donutTotal) * 100;
      const start = acc;
      const end = acc + pct;
      acc = end;
      stops.push(`${c} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
      items.push(
        `<div><span class="sw" style="background:${c}"></span>${esc(s.label)}<span class="val">${Math.round(pct)}%</span></div>`
      );
    });
    gradient = `conic-gradient(${stops.join(',')})`;
    legend = items.join('');
  }

  // Inyecta el gradiente como style inline en el .donut (gana sobre el CSS).
  out = out.replace(
    '<div class="donut"><div class="ctr">',
    () => `<div class="donut" style="background:${gradient}"><div class="ctr">`
  );
  // Total del centro.
  out = out.replace(
    '<div class="ctr"><b>$4.28k</b>',
    () => `<div class="ctr"><b>${kfmt(donutTotal)}</b>`
  );
  // Leyenda.
  out = out.replace(
    /(<div class="leg">\s*)(?:<div><span class="sw"[\s\S]*?<\/div>\s*)+(<\/div>)/,
    (_m, g1, g2) => `${g1}${legend}${g2}`
  );

  return out;
}
