import { CRM_STATUSES, PIPELINE_STATUSES } from './config.js';
import { loadGoogleSheetLeads } from './data/sheets.js';
import { loadCrmRecords, persistCrmRecord } from './data/crm-api.js';
import { sampleLeads } from './data/sample-leads.js';
import { budget, dedupeAndSort, formatDate, interest, leadDateValue, leadId, normalizePhone, value, whatsappUrl } from './utils/leads.js';

const app = document.querySelector('#app');
const state = { leads: [], crm: {}, view: 'list', selected: null, query: '', filters: {} };
const esc = (text = '') => String(text).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const crmOf = lead => ({ status: 'Novo', ...state.crm[leadId(lead)] });
const nameOf = lead => value(lead, 'nome_completo') || 'Lead sem nome';
const initials = name => name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
const today = () => new Date().toDateString();

function options(key) { return [...new Set(state.leads.map(l => key === 'interest' ? interest(l) : value(l, key)).filter(Boolean))].sort(); }
function filtered() {
  const q = state.query.toLowerCase().trim(); const f = state.filters;
  return state.leads.filter(lead => {
    const crm = crmOf(lead); const text = [nameOf(lead), value(lead, 'número_do_whatsapp'), value(lead, 'email')].join(' ').toLowerCase();
    const created = new Date(value(lead, 'created_time'));
    return (!q || text.includes(q)) && (!f.campaign || value(lead,'campaign_name') === f.campaign) && (!f.adset || value(lead,'adset_name') === f.adset) && (!f.platform || value(lead,'platform') === f.platform) && (!f.interest || interest(lead) === f.interest) && (!f.status || crm.status === f.status) && (!f.owner || crm.owner === f.owner) && (!f.period || (f.period === 'today' ? created.toDateString() === today() : true));
  });
}
function selectOptions(items, selected, placeholder) { return `<option value="">${placeholder}</option>${items.map(x => `<option ${x === selected ? 'selected':''}>${esc(x)}</option>`).join('')}`; }
function metric(label, count, tone = '') { return `<article class="metric ${tone}"><span>${label}</span><strong>${count}</strong></article>`; }
function renderLead(lead, compact = false) {
  const crm = crmOf(lead), phone = normalizePhone(value(lead, 'número_do_whatsapp')), url = whatsappUrl(lead);
  return `<article class="lead-card" data-id="${esc(leadId(lead))}"><button class="lead-main" data-open="${esc(leadId(lead))}"><span class="avatar">${initials(nameOf(lead))}</span><span class="lead-copy"><strong>${esc(nameOf(lead))}</strong><small>${esc(interest(lead))} · Parcela: ${esc(budget(lead))}</small><small>${esc(value(lead,'platform') || 'Não informado')} · ${formatDate(value(lead,'created_time'))}</small></span><span class="status status-${crm.status.replaceAll(' ','-').toLowerCase()}">${esc(crm.status)}</span></button>${!compact ? `<div class="lead-actions"><select class="status-select" data-status="${esc(leadId(lead))}">${CRM_STATUSES.map(status => `<option ${status === crm.status ? 'selected' : ''}>${status}</option>`).join('')}</select><button class="whatsapp" data-whatsapp="${esc(leadId(lead))}" ${phone ? '' : 'disabled'}>${phone ? '◉ Chamar no WhatsApp' : 'Telefone não informado'}</button></div>` : ''}</article>`;
}
function render() {
  const leads = filtered(); const byStatus = status => state.leads.filter(l => crmOf(l).status === status);
  const todayLeads = state.leads.filter(l => new Date(value(l,'created_time')).toDateString() === today());
  const noContact = state.leads.filter(l => !crmOf(l).firstContact && crmOf(l).status === 'Novo');
  app.innerHTML = `<main><header><div><p class="eyebrow">CENTRAL DE ATENDIMENTO</p><h1>Colinas do Sol</h1><p class="subtitle">Leads de campanhas Meta Ads, organizados para vender.</p></div><div class="header-actions"><span class="data-source">● ${state.source || 'Carregando'}</span><button id="refresh" class="icon-button" title="Atualizar">↻</button></div></header>
  <section class="metrics">${metric('Total de leads', state.leads.length)}${metric('Leads hoje',todayLeads.length,'blue')}${metric('Leads novos',byStatus('Novo').length,'green')}${metric('Sem contato',noContact.length,'orange')}${metric('Qualificados',byStatus('Qualificado').length)}${metric('Visitas agendadas',byStatus('Visita agendada').length)}${metric('Vendas',byStatus('Venda').length,'green')}</section>
  <section class="toolbar"><label class="search">⌕ <input id="search" placeholder="Buscar nome, WhatsApp ou e-mail" value="${esc(state.query)}"></label><select data-filter="period">${selectOptions(['today'],state.filters.period,'Todo o período')}</select><select data-filter="campaign">${selectOptions(options('campaign_name'),state.filters.campaign,'Campanhas')}</select><select data-filter="adset">${selectOptions(options('adset_name'),state.filters.adset,'Conjuntos')}</select><select data-filter="platform">${selectOptions(options('platform'),state.filters.platform,'Plataformas')}</select><select data-filter="interest">${selectOptions(options('interest'),state.filters.interest,'Interesse')}</select><select data-filter="status">${selectOptions(CRM_STATUSES,state.filters.status,'Status CRM')}</select><select data-filter="owner">${selectOptions(options('owner'),state.filters.owner,'Responsável')}</select></section>
  <nav class="view-tabs"><button class="${state.view==='list'?'active':''}" data-view="list">Lista <b>${leads.length}</b></button><button class="${state.view==='pipeline'?'active':''}" data-view="pipeline">Pipeline</button></nav>
  ${state.view === 'list' ? `<section class="lead-list"><div class="list-heading"><span>Lead</span><span>Status e ações</span></div>${leads.length ? leads.map(l=>renderLead(l)).join('') : '<div class="empty">Nenhum lead encontrado com estes filtros.</div>'}</section>` : `<section class="pipeline">${PIPELINE_STATUSES.map(status => `<div class="pipeline-column"><div class="pipeline-title"><span>${status}</span><b>${leads.filter(l=>crmOf(l).status===status).length}</b></div>${leads.filter(l=>crmOf(l).status===status).map(l=>renderLead(l,true)).join('') || '<p class="empty-column">Sem leads</p>'}</div>`).join('')}</section>`}
  ${state.selected ? renderDrawer(state.selected) : ''}</main>`;
  bind();
}
function renderDrawer(lead) {
  const crm = crmOf(lead); const field = (label,key,type='text') => `<label>${label}<input name="${key}" type="${type}" value="${esc(crm[key] || '')}"></label>`;
  const read = (label,content) => `<div class="read-field"><span>${label}</span><strong>${esc(content || 'Não informado')}</strong></div>`;
  return `<div class="overlay" id="close-drawer"></div><aside class="drawer"><button class="drawer-close" id="drawer-close">×</button><p class="eyebrow">DETALHES DO LEAD</p><h2>${esc(nameOf(lead))}</h2><div class="drawer-section"><h3>Dados da Meta</h3><div class="details">${read('WhatsApp',value(lead,'número_do_whatsapp'))}${read('E-mail',value(lead,'email'))}${read('Interesse',interest(lead))}${read('Resposta sobre parcela',budget(lead))}${read('Plataforma',value(lead,'platform'))}${read('Criação',formatDate(value(lead,'created_time')))}${read('Campanha',value(lead,'campaign_name'))}${read('Conjunto',value(lead,'adset_name'))}${read('Anúncio',value(lead,'ad_name'))}${read('Formulário',value(lead,'form_name'))}${read('Status Meta',value(lead,'lead_status'))}</div></div><form id="crm-form" class="drawer-section"><h3>Atendimento comercial</h3><label>Status CRM<select name="status">${CRM_STATUSES.map(s=>`<option ${crm.status===s?'selected':''}>${s}</option>`).join('')}</select></label>${field('Responsável','owner')}${field('Data do primeiro contato','firstContact','datetime-local')}${field('Último contato','lastContact','datetime-local')}${field('Data da visita','visitDate','datetime-local')}<label>Resultado<input name="result" value="${esc(crm.result || '')}"></label><label>Observações<textarea name="notes">${esc(crm.notes || '')}</textarea></label><button class="save" type="submit">Salvar atendimento</button></form></aside>`;
}
async function save(lead, changes) { state.crm[leadId(lead)] = await persistCrmRecord(leadId(lead), changes); render(); }
function bind() {
  document.querySelector('#search')?.addEventListener('input', e => { state.query=e.target.value; render(); });
  document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('change', e => { state.filters[e.target.dataset.filter]=e.target.value; render(); }));
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', e => { state.view=e.currentTarget.dataset.view; render(); }));
  document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => { state.selected = state.leads.find(l=>leadId(l)===el.dataset.open); render(); }));
  document.querySelectorAll('[data-status]').forEach(el => el.addEventListener('change', () => { const lead=state.leads.find(l=>leadId(l)===el.dataset.status); save(lead,{status:el.value}); }));
  document.querySelectorAll('[data-whatsapp]').forEach(el => el.addEventListener('click', async () => { const lead=state.leads.find(l=>leadId(l)===el.dataset.whatsapp); const crm=crmOf(lead); const now=new Date().toISOString().slice(0,16); await save(lead,{ ...(crm.status==='Novo'?{status:'Contato iniciado'}:{}), firstContact:crm.firstContact||now, lastContact:now }); window.open(whatsappUrl(lead),'_blank','noopener'); }));
  document.querySelector('#close-drawer')?.addEventListener('click',()=>{state.selected=null;render();}); document.querySelector('#drawer-close')?.addEventListener('click',()=>{state.selected=null;render();});
  document.querySelector('#crm-form')?.addEventListener('submit', async e => { e.preventDefault(); const values=Object.fromEntries(new FormData(e.currentTarget)); await save(state.selected,values); });
  document.querySelector('#refresh')?.addEventListener('click', initialize);
}
async function initialize() {
  try { const [sheet, crm] = await Promise.all([loadGoogleSheetLeads(),loadCrmRecords()]); state.leads=dedupeAndSort(sheet); state.crm=crm; state.source='Planilha conectada'; if (!state.leads.length) throw new Error(); }
  catch { state.leads=dedupeAndSort(sampleLeads); state.crm=await loadCrmRecords(); state.source='Modo demonstração'; }
  render();
}
initialize();
