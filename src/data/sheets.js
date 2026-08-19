import { SHEETS_CONFIG } from '../config.js';

const normalizeHeader = (value = '') => String(value).trim().toLowerCase();

function parseGviz(text) {
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!match) throw new Error('Resposta da planilha em formato inesperado.');
  const table = JSON.parse(match[1]).table;
  const headers = table.cols.map((column) => normalizeHeader(column.label));
  return table.rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row.c[index]?.v ?? ''])));
}

export async function loadGoogleSheetLeads() {
  if (!SHEETS_CONFIG.enabled) return [];
  const { spreadsheetId, gid } = SHEETS_CONFIG;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível acessar a planilha.');
  return parseGviz(await response.text());
}
