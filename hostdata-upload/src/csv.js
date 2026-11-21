// src/csv.js — CSV export aman (anti formula/CSV injection)
// Nilai yang diawali = + - @ TAB CR diberi prefix ' agar tidak dieksekusi Excel/Sheets.
function cell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return '\uFEFF' + lines.join('\r\n'); // BOM agar Excel baca UTF-8
}
