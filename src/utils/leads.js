const INTEREST_KEY = 'você_está_buscando_um_lote_para:';
const BUDGET_KEY = 'nossos_lotes_têm_parcelas_a_partir_de_r$_1.258._você_acredita_que_esse_valor_cabe_no_seu_orçamento?:';

export const value = (lead, key) => lead[key] ?? '';
export const leadId = (lead) => String(lead.id || `${lead.email}|${lead['número_do_whatsapp']}|${lead.created_time}`);
const normalizeKey = (key = '') => String(key).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
function flexibleValue(lead, key) {
  if (lead[key] != null) return lead[key];
  const found = Object.keys(lead).find(header => normalizeKey(header) === normalizeKey(key));
  return found ? lead[found] : '';
}
export const interest = (lead) => flexibleValue(lead, INTEREST_KEY) || 'Não informado';
export const budget = (lead) => flexibleValue(lead, BUDGET_KEY) || 'Não informado';
export function origin(lead) {
  const raw = String(value(lead, 'platform') || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (raw === 'fb' || raw === 'facebook') return 'Facebook';
  if (raw === 'ig' || raw === 'instagram') return 'Instagram';
  return value(lead, 'platform') || 'Não informado';
}
export function displayInterest(lead) {
  const raw = String(interest(lead));
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'uniroutilaoagradavel') return 'Unir o útil ao agradável';
  return raw.split(/[\s_-]+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ') || 'Não informado';
}
export const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
export function whatsappUrl(lead) {
  const phone = normalizePhone(value(lead, 'número_do_whatsapp'));
  if (!phone) return null;
  const name = value(lead, 'nome_completo').split(' ')[0] || 'tudo bem';
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${name}! Tudo bem? Recebemos seu interesse em nossos lotes e estou à disposição para ajudar.`)}`;
}
export function formatDate(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.valueOf()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}
export function leadDateValue(lead) { const date = new Date(value(lead, 'created_time')); return Number.isNaN(date.valueOf()) ? 0 : date.valueOf(); }
export function dedupeAndSort(leads) {
  const seen = new Map();
  for (const lead of leads) { const id = leadId(lead); if (!seen.has(id) || leadDateValue(lead) > leadDateValue(seen.get(id))) seen.set(id, lead); }
  return [...seen.values()].sort((a, b) => leadDateValue(b) - leadDateValue(a));
}
