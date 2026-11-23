import "dotenv/config";

// los tests nunca mandan mails reales: sin SMTP, como en CI, se usa el adaptador de consola.
// Vacías y no borradas: dotenv no pisa variables existentes cuando src/db/client.ts lo vuelve a cargar.
for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"]) {
  process.env[key] = "";
}
