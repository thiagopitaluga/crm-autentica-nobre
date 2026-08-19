# CRM Autêntica Nobre

Painel web de acompanhamento de leads do Meta Ads. A planilha de origem é somente leitura: nenhuma ação do painel altera os dados recebidos da Meta.

## Arquitetura

`Meta Ads → aba LEADS_META (leitura) → Painel CRM ← aba CRM (dados comerciais)`

- `src/data/sheets.js`: lê os leads da aba Meta por Google Visualization API.
- `src/data/crm-api.js`: camada de persistência comercial. Sem API configurada, usa `localStorage` para demonstração.
- `src/utils/leads.js`: normalização, deduplicação e regras de WhatsApp.
- `src/app.js`: interface e estado da aplicação.

O vínculo é sempre `lead_id` (a coluna `id` do Meta). Status Meta e Status CRM são campos independentes.

## Conectar ao Google Sheets

1. Mantenha a aba original do Meta intocada; sugere-se renomeá-la para `LEADS_META`.
2. Crie uma segunda aba chamada `CRM`, com o cabeçalho:
   `lead_id | status | owner | firstContact | lastContact | notes | visitDate | result | updatedAt`
3. Compartilhe a planilha com **qualquer pessoa com o link: leitor** (ou publique a aba), para permitir a leitura pelo painel.
4. Em `src/config.js`, confira o `spreadsheetId` e o `gid` da aba `LEADS_META`.
5. Para gravação compartilhada, crie um projeto Apps Script anexado à planilha, cole o script abaixo e publique como **Web app** (executar como você; acesso conforme a política da equipe). Depois, cole a URL publicada em `CRM_API_URL`.

```js
const SHEET = 'CRM';
function doGet() {
  const rows = SpreadsheetApp.getActive().getSheetByName(SHEET).getDataRange().getValues();
  const [headers, ...data] = rows;
  const result = Object.fromEntries(data.filter(r => r[0]).map(row => [row[0], Object.fromEntries(headers.map((h, i) => [h, row[i]]))]));
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  const item = JSON.parse(e.postData.contents); const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues().flat() : [];
  const row = headers.map(h => item[h] || ''); const index = ids.indexOf(item.lead_id);
  index < 0 ? sheet.appendRow(row) : sheet.getRange(index + 2, 1, 1, headers.length).setValues([row]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

> Para produção com dados pessoais, proteja a API com autenticação (por exemplo, um backend com Google service account). Um Web App aberto não deve ficar exposto sem um controle de acesso adequado.

## Atualização automática de leads

Depois que a aba de origem estiver acessível, o painel consulta a planilha automaticamente a cada **60 segundos**. Todo novo registro recebido do Meta aparece no CRM sem cadastro manual, com `Status CRM = Novo`. A atualização também pode ser disparada pelo botão de recarregar.

O endereço informado atualmente responde `401` (planilha privada), então o painel não consegue ler os leads reais até que você libere acesso de leitura ou disponibilize uma API autenticada.

## Executar localmente

Como é uma aplicação estática, use qualquer servidor local, por exemplo: `npx serve .`.
