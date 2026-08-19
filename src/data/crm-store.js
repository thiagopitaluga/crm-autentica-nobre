const KEY = 'leadflow-crm-v1';

export function getCrmRecords() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function saveCrmRecord(id, changes) {
  const records = getCrmRecords();
  records[id] = { ...records[id], ...changes, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(records));
  return records[id];
}
