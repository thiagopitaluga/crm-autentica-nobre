export const SHEETS_CONFIG = {
  spreadsheetId: '16vPlPLOw1x8cPktZP7AWt-dh2qJU3Ow-USIeuBOe9Nk',
  gid: '0',
  // A planilha precisa estar publicada ou acessível a "qualquer pessoa com o link".
  enabled: true,
};

// Cole aqui a URL do Web App do Apps Script para persistir os dados do CRM na aba "CRM".
// Sem ela, o painel funciona em modo local (localStorage), ótimo para demonstração.
export const CRM_API_URL = 'https://script.google.com/macros/s/AKfycbzJOyk98Yzt6WkcYBoHhjLrCnYX2_gauY2OFF32DiEYC5fR3-dXb-BbjiZgp7g_Ma_p/exec';
export const LEAD_SYNC_INTERVAL_MS = 60_000;

export const CRM_STATUSES = ['Novo', 'Contato iniciado', 'Conversando', 'Qualificado', 'Visita agendada', 'Proposta', 'Venda', 'Sem interesse', 'Sem resposta'];
export const PIPELINE_STATUSES = CRM_STATUSES.slice(0, 7);
