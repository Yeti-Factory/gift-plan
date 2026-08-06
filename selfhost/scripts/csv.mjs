import { readFile } from "node:fs/promises";

export function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV invalide : guillemet non fermé");
  if (field.length > 0 || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((cell) => cell.length > 0));
}

export async function readCsv(file) {
  const content = await readFile(file, "utf8");
  const rows = parseCsv(content.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => header.length === 0)) {
    throw new Error(`${file} contient un nom de colonne vide`);
  }

  return rows.slice(1).map((row, rowIndex) => {
    if (row.length !== headers.length) {
      throw new Error(
        `${file}, ligne ${rowIndex + 2} : ${row.length} valeurs pour ${headers.length} colonnes`,
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  });
}
