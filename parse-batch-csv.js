const stripAccents = (value) => {
  if (value == null) return "";
  const str = String(value);
  const normalized =
    typeof str.normalize === "function"
      ? str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\u00a0/g, " ")
      : str;
  return normalized.replace(/[×✕✖]/g, "x");
};

const normalizeToken = (token) =>
  stripAccents(token)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9x]/g, "");

const detectDelimiter = (line) => {
  if (!line) return ";";
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  if (semi === 0 && comma === 0) return ";";
  return semi >= comma ? ";" : ",";
};

const splitCsvLine = (line, delimiter) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let idx = 0; idx < line.length; idx++) {
    const char = line[idx];
    if (idx === 0 && char === "\ufeff") continue;
    if (inQuotes) {
      if (char === "\"") {
        if (line[idx + 1] === "\"") {
          current += "\"";
          idx++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === delimiter) {
      result.push(current);
      current = "";
    } else if (char === "\r") {
      continue;
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const looksLikeHeader = (cells) => {
  if (!Array.isArray(cells) || !cells.length) return false;
  const sample = cells.map((cell) => normalizeToken(cell || ""));
  const headerHints = new Set([
    "client",
    "clients",
    "nom",
    "name",
    "designation",
    "qty",
    "quantite",
    "qte",
    "qt",
  ]);
  return (
    headerHints.has(sample[6]) ||
    headerHints.has(sample[7]) ||
    headerHints.has(sample[11])
  );
};

const parseQuantity = (value) => {
  if (value == null) return null;
  const normalized = String(value).replace(/[^0-9]/g, "");
  if (!normalized) return null;
  const num = Number.parseInt(normalized, 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

const parseDeadline = (value) => {
  if (value == null) return null;
  const str = stripAccents(String(value)).trim();
  if (!str) return null;
  const full = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (full) {
    const [, day, month, year] = full;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const short = str.match(/^(\d{2})\/(\d{2})$/);
  if (short) {
    const [, day, month] = short;
    const year = new Date().getFullYear();
    return new Date(year, Number(month) - 1, Number(day)).getTime();
  }
  return null;
};

const FORMAT_TOKEN_MAP = {
  diam: {
    "28": "28 mm",
    "28mm": "28 mm",
    "38": "38 mm",
    "38mm": "38 mm",
    "45": "45 mm",
    "45mm": "45 mm",
    "58": "58 mm",
    "58mm": "58 mm",
    "89": "89 mm",
    "89mm": "89 mm",
    "rect": "Rect. 80 × 50 mm",
    "rectangle": "Rect. 80 × 50 mm",
    "rectangulaire": "Rect. 80 × 50 mm",
    "80x50": "Rect. 80 × 50 mm",
    "80*50": "Rect. 80 × 50 mm",
    "8050": "Rect. 80 × 50 mm",
    "80×50": "Rect. 80 × 50 mm",
  },
  type: {
    mag: "Aimant décoratif",
    aimant: "Aimant décoratif",
    magnet: "Aimant décoratif",
    aimantdecoratif: "Aimant décoratif",
    decoratif: "Aimant décoratif",
    neo: "Magnétique textile",
    neodyme: "Magnétique textile",
    magnetique: "Magnétique textile",
    textile: "Magnétique textile",
    epi: "Épingle",
    epingle: "Épingle",
    pin: "Épingle",
    decap: "Décapsuleur magnet",
    decapsuleur: "Décapsuleur magnet",
  },
  finish: {
    st: "Mat",
    satine: "Mat",
    satinee: "Mat",
    satiné: "Mat",
    mat: "Mat",
    matte: "Mat",
    br: "Brillant",
    brillant: "Brillant",
    brillante: "Brillant",
    gloss: "Brillant",
  },
};

const parseFormatCell = (cell, defaults) => {
  const normalized = stripAccents(cell || "")
    .toLowerCase()
    .replace(/(\d+)\/(\d+)/g, "$1x$2");
  const rawTokens = normalized
    .split(/[^a-z0-9x]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set();
  const unknownTokens = [];
  let diam = null;
  let type = null;
  let finish = null;
  rawTokens.forEach((tokenRaw) => {
    if (!tokenRaw) return;
    const token = normalizeToken(tokenRaw);
    if (!token || seen.has(token)) return;
    seen.add(token);
    if (!diam) {
      const mappedDiam = FORMAT_TOKEN_MAP.diam[token];
      if (mappedDiam) {
        diam = mappedDiam;
        return;
      }
      if (token.endsWith("mm")) {
        const base = token.replace(/mm$/, "");
        if (FORMAT_TOKEN_MAP.diam[base]) {
          diam = FORMAT_TOKEN_MAP.diam[base];
          return;
        }
      }
    }
    if (!type) {
      const mappedType = FORMAT_TOKEN_MAP.type[token];
      if (mappedType) {
        type = mappedType;
        return;
      }
    }
    if (!finish) {
      const mappedFinish = FORMAT_TOKEN_MAP.finish[token];
      if (mappedFinish) {
        finish = mappedFinish;
        return;
      }
    }
    unknownTokens.push(tokenRaw);
  });
  return {
    diam: diam || defaults.diam || "",
    type: type || defaults.type || "",
    finish: finish || defaults.finish || "",
    unknownTokens,
  };
};

const cleanValue = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

export function parseBatchCsv(input, defaults = {}) {
  if (typeof input !== "string") {
    throw new Error("Le contenu CSV doit être une chaîne de caractères.");
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  const now = Date.now();
  const defaultsDeadline = parseDeadline(defaults.deadline);
  const results = [];
  let headerSkipped = false;
  lines.forEach((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    if (!cells.length) return;
    if (!headerSkipped && looksLikeHeader(cells)) {
      headerSkipped = true;
      return;
    }
    const qty = parseQuantity(cells[11]);
    const client = cleanValue(cells[6]) || cleanValue(defaults.client);
    const name = cleanValue(cells[7]) || cleanValue(defaults.name);
    if (!qty || !client || !name) {
      return;
    }
    const formatInfo = parseFormatCell(cells[3], defaults);
    const baseNote = cleanValue(cells[8]);
    const noteParts = [];
    if (defaults.note) noteParts.push(String(defaults.note));
    if (baseNote) noteParts.push(baseNote);
    if (formatInfo.unknownTokens.length) {
      noteParts.push(`Tokens inconnus: ${formatInfo.unknownTokens.join(", ")}`);
    }
    const deadline = parseDeadline(cells[2]);
    results.push({
      client,
      name,
      qty,
      diam: formatInfo.diam,
      finish: formatInfo.finish,
      type: formatInfo.type,
      carton: cleanValue(defaults.carton),
      deadline: Number.isFinite(deadline)
        ? deadline
        : Number.isFinite(defaultsDeadline)
        ? defaultsDeadline
        : null,
      note: noteParts.join("\n").trim(),
      status: "wait",
      startTime: now,
      endTime: null,
      durationSec: 0,
    });
  });
  const preview = results.slice(0, 5);
  if (preview.length) {
    console.log("Aperçu import badges (5 premiers):", preview);
  } else {
    console.log("Aucun enregistrement interprété depuis le CSV batch.");
  }
  return results;
}

if (typeof window !== "undefined") {
  window.parseBatchCsv = parseBatchCsv;
}

export default parseBatchCsv;
