export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((candidate) =>
    candidate.some((value) => value.trim() !== "")
  );
}

export function rowsToObjects(rows: string[][]) {
  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const headers = rows[0].map((value) => value.trim());

  if (headers.some((header) => !header)) {
    throw new Error("CSV contains a blank header.");
  }

  const duplicates = headers.filter(
    (header, index) => headers.indexOf(header) !== index
  );

  if (duplicates.length > 0) {
    throw new Error(
      `CSV contains duplicate headers: ${Array.from(new Set(duplicates)).join(", ")}`
    );
  }

  return rows.slice(1).map((values, index) => {
    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header] = (values[columnIndex] ?? "").trim();
    });

    return {
      rowNumber: index + 2,
      record,
    };
  });
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  const protectedText =
    /^[=+\-@]/.test(text) ? `'${text}` : text;

  if (/[",\r\n]/.test(protectedText)) {
    return `"${protectedText.replaceAll('"', '""')}"`;
  }

  return protectedText;
}
