import { CRM_API_URL } from '../config.js';
import { getCrmRecords, saveCrmRecord } from './crm-store.js';

function endpoint(resource) {
  return `${CRM_API_URL}${CRM_API_URL.includes('?') ? '&' : '?'}resource=${resource}`;
}

async function readJson(url) {
  const response = await fetch(url);
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('application/json')) {
    throw new Error('A API do Apps Script não retornou JSON.');
  }
  return response.json();
}

export async function loadCrmSnapshot() {
  if (!CRM_API_URL) return null;
  const snapshot = await readJson(endpoint('snapshot'));
  if (!Array.isArray(snapshot.leads) || !snapshot.crm) {
    throw new Error('Resposta da API CRM inválida.');
  }
  return snapshot;
}

export async function loadCrmRecords() {
  if (!CRM_API_URL) return getCrmRecords();
  return readJson(endpoint('crm'));
}

export async function persistCrmRecord(id, changes) {
  const optimistic = saveCrmRecord(id, changes);
  if (!CRM_API_URL) return optimistic;
  const response = await fetch(CRM_API_URL, { method: 'POST', body: JSON.stringify({ lead_id: id, ...optimistic }) });
  if (!response.ok) throw new Error('Não foi possível salvar o registro comercial.');
  return optimistic;
}
