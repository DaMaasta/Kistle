// Postgres-Fehler, die auf ungültige Eingaben zurückgehen (Constraint verletzt, falscher
// Datentyp, Fremdschlüssel fehlt …), als 400 statt 500 beantworten.
const CLIENT_ERROR_CODES = new Set([
  '22001', // Text zu lang
  '22003', // Zahl außerhalb des Bereichs
  '22P02', // ungültiges Format (z.B. Text statt Zahl)
  '23502', // Pflichtfeld fehlt
  '23503', // verweist auf nicht existierenden Datensatz
  '23514', // CHECK-Constraint (z.B. unbekannte Einheit oder Typ)
]);

function sendDbError(res, err, fallbackMessage) {
  if (CLIENT_ERROR_CODES.has(err?.code)) {
    return res.status(400).json({ error: 'Ungültige Eingabe' });
  }
  console.error(err);
  return res.status(500).json({ error: fallbackMessage });
}

module.exports = { sendDbError };
