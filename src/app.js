import { CRM_API_URL, CRM_STATUSES, LEAD_SYNC_INTERVAL_MS, PIPELINE_STATUSES } from './config.js';
import { loadGoogleSheetLeads } from './data/sheets.js';
import { loadCrmRecords, loadCrmSnapshot, persistCrmRecord } from './data/crm-api.js';
import { sampleLeads } from './data/sample-leads.js';
import { budget, dedupeAndSort, displayInterest, formatDate, interest, leadDateValue, leadId, normalizePhone, origin, value, whatsappUrl } from './utils/leads.js';

const app = document.querySelector('#app');
const state = { leads: [], crm: {}, view: 'list', selected: null, query: '', filters: {}, activeMetric: '', activeMetricLabel: '', syncing: false };
const esc = (text = '') => String(text).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const crmOf = lead => ({ status: 'Novo', ...state.crm[leadId(lead)] });
const nameOf = lead => value(lead, 'nome_completo') || 'Lead sem nome';
const initials = name => name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
const today = () => new Date().toDateString();
const toDateInput = (date) => { const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10); };
const dateStart = (value) => value ? new Date(`${value}T00:00:00`) : null;
const dateEnd = (value) => value ? new Date(`${value}T23:59:59.999`) : null;
function isInPeriod(lead, filters) {
  const date = new Date(value(lead, 'created_time'));
  if (Number.isNaN(date.valueOf())) return !filters.start && !filters.end && !filters.period;
  if (filters.start && date < dateStart(filters.start)) return false;
  if (filters.end && date > dateEnd(filters.end)) return false;
  return true;
}

function options(key) { return [...new Set(state.leads.map(l => key === 'interest' ? displayInterest(l) : key === 'origin' ? origin(l) : value(l, key)).filter(Boolean))].sort(); }
function filtered() {
  const q = state.query.toLowerCase().trim(); const f = state.filters;
  return state.leads.filter(lead => {
    const crm = crmOf(lead); const text = [nameOf(lead), value(lead, 'número_do_whatsapp'), value(lead, 'email')].join(' ').toLowerCase();
    const created = new Date(value(lead, 'created_time'));
    return (!q || text.includes(q)) && (!f.campaign || value(lead,'campaign_name') === f.campaign) && (!f.adset || value(lead,'adset_name') === f.adset) && (!f.origin || origin(lead) === f.origin) && (!f.interest || displayInterest(lead) === f.interest) && (!f.status || crm.status === f.status) && (!f.owner || crm.owner === f.owner) && (!f.uncontacted || (!crm.firstContact && crm.status === 'Novo')) && isInPeriod(lead, f);
  });
}
function selectOptions(items, selected, placeholder) { return `<option value="">${placeholder}</option>${items.map(x => `<option ${x === selected ? 'selected':''}>${esc(x)}</option>`).join('')}`; }
function applyPeriodPreset(period) {
  const now = new Date(); let start = null; let end = null;
  if (period === 'today') start = end = now;
  if (period === 'yesterday') { start = new Date(now); start.setDate(now.getDate() - 1); end = start; }
  if (period === 'last7') { start = new Date(now); start.setDate(now.getDate() - 6); end = now; }
  if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = now; }
  if (period === 'last30') { start = new Date(now); start.setDate(now.getDate() - 29); end = now; }
  state.filters.period = period;
  state.filters.start = start ? toDateInput(start) : '';
  state.filters.end = end ? toDateInput(end) : '';
}
function clearFilters() { state.query = ''; state.filters = {}; state.activeMetric = ''; state.activeMetricLabel = ''; }
function metric(label, count, tone = '', filter = 'all') { return `<button class="metric ${tone} ${state.activeMetric === filter ? 'selected' : ''}" data-metric="${filter}" data-metric-label="${label}"><span>${label}</span><strong>${count}</strong></button>`; }
function activeFilterMessage() {
  if (state.activeMetric) return `Exibindo somente: <strong>${esc(state.activeMetricLabel)}</strong>`;
  if (state.filters.start || state.filters.end) return `Período selecionado: <strong>${esc(state.filters.start || '18/08/2026')} até ${esc(state.filters.end || 'hoje')}</strong>`;
  return '';
}
function renderLead(lead, compact = false) {
  const crm = crmOf(lead), phone = normalizePhone(value(lead, 'número_do_whatsapp')), url = whatsappUrl(lead);
  const whatsapp = `<button class="whatsapp" data-whatsapp="${esc(leadId(lead))}" ${phone ? '' : 'disabled'}>${phone ? '◉ Chamar no WhatsApp' : 'Telefone não informado'}</button>`;
  const status = `<select class="status-select" data-status="${esc(leadId(lead))}">${CRM_STATUSES.map(status => `<option ${status === crm.status ? 'selected' : ''}>${status}</option>`).join('')}</select>`;
  return `<article class="lead-card" data-id="${esc(leadId(lead))}"><button class="lead-main" data-open="${esc(leadId(lead))}"><span class="avatar">${initials(nameOf(lead))}</span><span class="lead-copy"><strong>${esc(nameOf(lead))}</strong><span class="lead-meta"><small><b>Interesse</b> ${esc(displayInterest(lead))}</small><small><b>Parcela</b> ${esc(budget(lead))}</small><small><b>Origem</b> ${esc(origin(lead))}</small><small>${formatDate(value(lead,'created_time'))}</small></span></span><span class="status status-${crm.status.replaceAll(' ','-').toLowerCase()}">${esc(crm.status)}</span></button><div class="lead-actions ${compact ? 'pipeline-actions' : ''}">${status}${whatsapp}</div></article>`;
}
function render() {
  const leads = filtered(); const byStatus = status => state.leads.filter(l => crmOf(l).status === status);
  const todayLeads = state.leads.filter(l => new Date(value(l,'created_time')).toDateString() === today());
  const noContact = state.leads.filter(l => !crmOf(l).firstContact && crmOf(l).status === 'Novo');
  app.innerHTML = `<main><header><div><p class="eyebrow">CENTRAL DE ATENDIMENTO</p><h1>Autêntica Nobre</h1><p class="subtitle">Corretora Morgana Fernandes</p></div><div class="header-actions"><span class="data-source">● ${state.source || 'Carregando'}</span><button id="refresh" class="icon-button" title="Atualizar">↻</button></div></header>
  <section class="metrics">${metric('Total de leads', state.leads.length,'','all')}${metric('Leads hoje',todayLeads.length,'blue','today')}${metric('Leads novos',byStatus('Novo').length,'green','Novo')}${metric('Sem contato',noContact.length,'orange','uncontacted')}${metric('Qualificados',byStatus('Qualificado').length,'','Qualificado')}${metric('Visitas agendadas',byStatus('Visita agendada').length,'','Visita agendada')}${metric('Vendas',byStatus('Venda').length,'green','Venda')}</section>
  <section class="toolbar"><label class="search">⌕ <input id="search" placeholder="Buscar nome, WhatsApp ou e-mail" value="${esc(state.query)}"></label><select data-filter="period"><option value="">Período</option><option value="today" ${state.filters.period==='today'?'selected':''}>Hoje</option><option value="yesterday" ${state.filters.period==='yesterday'?'selected':''}>Ontem</option><option value="last7" ${state.filters.period==='last7'?'selected':''}>Últimos 7 dias</option><option value="month" ${state.filters.period==='month'?'selected':''}>Este mês</option><option value="last30" ${state.filters.period==='last30'?'selected':''}>Últimos 30 dias</option></select><div class="calendar-range"><span>◫ Calendário</span><label class="date-filter">De<input data-filter="start" type="date" min="2026-08-18" value="${esc(state.filters.start || '')}"></label><label class="date-filter">Até<input data-filter="end" type="date" min="2026-08-18" value="${esc(state.filters.end || '')}"></label></div><select data-filter="campaign">${selectOptions(options('campaign_name'),state.filters.campaign,'Campanhas')}</select><select data-filter="adset">${selectOptions(options('adset_name'),state.filters.adset,'Conjuntos')}</select><select data-filter="origin">${selectOptions(options('origin'),state.filters.origin,'Origem')}</select><select data-filter="interest">${selectOptions(options('interest'),state.filters.interest,'Interesse')}</select><select data-filter="status">${selectOptions(CRM_STATUSES,state.filters.status,'Status CRM')}</select><select data-filter="owner">${selectOptions(options('owner'),state.filters.owner,'Responsável')}</select><button class="clear-filters" id="clear-filters">Limpar filtros</button></section>${activeFilterMessage() ? `<div class="filter-feedback">${activeFilterMessage()}<button id="clear-filter-feedback">× Limpar</button></div>` : ''}
  <nav class="view-tabs"><button class="${state.view==='list'?'active':''}" data-view="list">Lista <b>${leads.length}</b></button><button class="${state.view==='pipeline'?'active':''}" data-view="pipeline">Pipeline</button></nav>
  ${state.view === 'list' ? `<section class="lead-list"><div class="list-heading"><span>Lead</span><span>Status e ações</span></div>${leads.length ? leads.map(l=>renderLead(l)).join('') : '<div class="empty">Nenhum lead encontrado com estes filtros.</div>'}</section>` : `<section class="pipeline">${PIPELINE_STATUSES.map(status => `<div class="pipeline-column"><div class="pipeline-title"><span>${status}</span><b>${leads.filter(l=>crmOf(l).status===status).length}</b></div>${leads.filter(l=>crmOf(l).status===status).map(l=>renderLead(l,true)).join('') || '<p class="empty-column">Sem leads</p>'}</div>`).join('')}</section>`}
  ${state.selected ? renderDrawer(state.selected) : ''}</main>`;
  bind();
}
function renderDrawer(lead) {
  const crm = crmOf(lead); const field = (label,key,type='text') => `<label>${label}<input name="${key}" type="${type}" value="${esc(crm[key] || '')}"></label>`;
  const read = (label,content) => `<div class="read-field"><span>${label}</span><strong>${esc(content || 'Não informado')}</strong></div>`;
  return `<div class="overlay" id="close-drawer"></div><aside class="drawer"><button class="drawer-close" id="drawer-close">×</button><p class="eyebrow">DETALHES DO LEAD</p><h2>${esc(nameOf(lead))}</h2><button class="whatsapp drawer-whatsapp" data-whatsapp="${esc(leadId(lead))}" ${normalizePhone(value(lead, 'número_do_whatsapp')) ? '' : 'disabled'}>${normalizePhone(value(lead, 'número_do_whatsapp')) ? '◉ Chamar no WhatsApp' : 'Telefone não informado'}</button><div class="drawer-section"><h3>Dados da Meta</h3><div class="details">${read('WhatsApp',value(lead,'número_do_whatsapp'))}${read('E-mail',value(lead,'email'))}${read('Interesse',displayInterest(lead))}${read('Resposta sobre parcela',budget(lead))}${read('Origem',origin(lead))}${read('Criação',formatDate(value(lead,'created_time')))}${read('Campanha',value(lead,'campaign_name'))}${read('Conjunto',value(lead,'adset_name'))}${read('Anúncio',value(lead,'ad_name'))}${read('Formulário',value(lead,'form_name'))}${read('Status Meta',value(lead,'lead_status'))}</div></div><form id="crm-form" class="drawer-section"><h3>Atendimento comercial</h3><label>Status CRM<select name="status">${CRM_STATUSES.map(s=>`<option ${crm.status===s?'selected':''}>${s}</option>`).join('')}</select></label>${field('Responsável','owner')}${field('Data do primeiro contato','firstContact','datetime-local')}${field('Último contato','lastContact','datetime-local')}${field('Data da visita','visitDate','datetime-local')}<label>Resultado<input name="result" value="${esc(crm.result || '')}"></label><label>Observações<textarea name="notes">${esc(crm.notes || '')}</textarea></label><button class="save" type="submit">Salvar atendimento</button></form></aside>`;
}
async function save(lead, changes) { state.crm[leadId(lead)] = await persistCrmRecord(leadId(lead), changes); render(); }
function bind() {
  document.querySelector('#search')?.addEventListener('input', e => { state.query=e.target.value; render(); });
  document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', e => {
    const key = e.target.dataset.filter;
    state.activeMetric = ''; state.activeMetricLabel = '';
    if (key === 'period') applyPeriodPreset(e.target.value);
    else { state.filters[key] = e.target.value; if (key === 'start' || key === 'end') state.filters.period = ''; }
    render();
  }));
  document.querySelectorAll('[data-metric]').forEach(el => el.addEventListener('click', () => {
    const metricFilter = el.dataset.metric; clearFilters(); if (metricFilter !== 'all') { state.activeMetric = metricFilter; state.activeMetricLabel = el.dataset.metricLabel; }
    if (metricFilter === 'today') applyPeriodPreset('today');
    else if (metricFilter === 'uncontacted') state.filters.uncontacted = true;
    else if (metricFilter !== 'all') state.filters.status = metricFilter;
    render();
  }));
  document.querySelector('#clear-filters')?.addEventListener('click', () => { clearFilters(); render(); });
  document.querySelector('#clear-filter-feedback')?.addEventListener('click', () => { clearFilters(); render(); });
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', e => { state.view=e.currentTarget.dataset.view; render(); }));
  document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => { state.selected = state.leads.find(l=>leadId(l)===el.dataset.open); render(); }));
  document.querySelectorAll('[data-status]').forEach(el => el.addEventListener('change', () => { const lead=state.leads.find(l=>leadId(l)===el.dataset.status); save(lead,{status:el.value}); }));
  document.querySelectorAll('[data-whatsapp]').forEach(el => el.addEventListener('click', async () => { const lead=state.leads.find(l=>leadId(l)===el.dataset.whatsapp); const crm=crmOf(lead); const now=new Date().toISOString().slice(0,16); await save(lead,{ ...(crm.status==='Novo'?{status:'Contato iniciado'}:{}), firstContact:crm.firstContact||now, lastContact:now }); window.open(whatsappUrl(lead),'_blank','noopener'); }));
  document.querySelector('#close-drawer')?.addEventListener('click',()=>{state.selected=null;render();}); document.querySelector('#drawer-close')?.addEventListener('click',()=>{state.selected=null;render();});
  document.querySelector('#crm-form')?.addEventListener('submit', async e => { e.preventDefault(); const values=Object.fromEntries(new FormData(e.currentTarget)); await save(state.selected,values); });
  document.querySelector('#refresh')?.addEventListener('click', () => syncLeads());
}
async function syncLeads({ initial = false } = {}) {
  if (state.syncing) return;
  state.syncing = true;
  try {
    const snapshot = CRM_API_URL ? await loadCrmSnapshot() : { leads: await loadGoogleSheetLeads() };
    state.leads = dedupeAndSort(snapshot.leads);
    if (snapshot.crm) state.crm = snapshot.crm;
    state.source = `Planilha conectada · atualizada ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date())}`;
  } catch {
    if (initial) state.leads = dedupeAndSort(sampleLeads);
    state.source = 'Planilha indisponível · modo demonstração';
  } finally { state.syncing = false; }
  render();
}
async function initialize() {
  if (!CRM_API_URL) state.crm = await loadCrmRecords();
  await syncLeads({ initial: true });
  window.setInterval(() => syncLeads(), LEAD_SYNC_INTERVAL_MS);
}
initialize();
