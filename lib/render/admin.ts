// lib/render/admin.ts
//
// Toma el markup estatico de content/admin.ts e inyecta los datos reales
// del dashboard ANTES de renderizar, preservando el diseno por completo.
//
// Solo reemplaza las secciones dinamicas (KPIs, tablas y listas) con
// anclas unicas y robustas. Lo que aun no se alimenta de datos (la grafica
// de barras de Revenue y el donut "Revenue by Service") se deja intacto.

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

export function renderAdminMarkup(markup: string, data: DashboardData): string {
  let out = markup;

  // --- KPIs (los data-count son valores unicos en el documento) ---
  out = out.replace('data-count="38"', `data-count="${data.totalClients}"`);
  out = out.replace('data-count="4280"', `data-count="${Math.round(data.monthlyRevenue)}"`);
  out = out.replace('data-count="620"', `data-count="${Math.round(data.outstanding)}"`);
  out = out.replace('data-count="7"', `data-count="${data.newLeads}"`);

  // --- Recent Payments (tbody anclado por su thead unico) ---
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
    `$1${payRows}$2`
  );

  // --- Top Clients (tbody anclado por su thead unico) ---
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
    `$1${topRows}$2`
  );

  // --- New Leads (lista de .lead) ---
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
    `$1${leadLabel}$2${leadsHtml}`
  );

  // --- Upcoming Renewals (lista de .ren) ---
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
    `$1${renHtml}`
  );

  return out;
}
