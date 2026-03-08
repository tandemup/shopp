// utils/helpers/isbn.js

// 🔍 Regex para detectar ISBN-10 o ISBN-13
export function isISBN(code) {
  if (!code) return false;

  const clean = code.replace(/[^0-9X]/gi, "");

  // ISBN-10
  if (/^\d{9}[0-9X]$/.test(clean)) return true;

  // ISBN-13 (978 / 979)
  if (/^97[89]\d{10}$/.test(clean)) return true;

  return false;
}
