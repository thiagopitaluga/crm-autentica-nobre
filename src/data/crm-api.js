import { CRM_API_URL } from '../config.js';
import { getCrmRecords, saveCrmRecord } from './crm-store.js';

export async function loadCrmRecords() {
  if (!CRM_API_URL) return getCrmRecords();
  const response = await fetch(CRM_API_URL);
  if (!response.ok) throw new Error('Não foi possível carregar os registros comerciais.');
  return await response.json();
}

export async function persistCrmRecord(id, changes) {
  const optimistic = saveCrmRecord(id, changes);
  if (!CRM_API_URL) return optimistic;
  const response = await fetch(CRM_API_URL, { method: 'POST', body: JSON.stringify({ lead_id: id, ...optimistic }) });
  if (!response.ok) throw new Error('Não foi possível salvar o registro comercial.');
  return optimistic;
}
