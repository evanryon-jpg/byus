// Small CSV helpers shared by the creator download routes.
//
// csvField quotes a value only when it has to, and also defuses spreadsheet
// formulas: a cell that starts with = + - @ (or a tab/carriage return) is run as a
// formula by Excel and Google Sheets when the file is opened. Member names and post
// text are typed by other people, so any such value gets a leading apostrophe,
// which spreadsheets show as plain text.

export function csvField(value) {
  let str = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function csvDocument(header, rows) {
  const lines = [header.map(csvField).join(',')];
  for (const row of rows) lines.push(row.map(csvField).join(','));
  // Leading byte-order mark so Excel opens accented names correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function csvResponse(csv, filename) {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
