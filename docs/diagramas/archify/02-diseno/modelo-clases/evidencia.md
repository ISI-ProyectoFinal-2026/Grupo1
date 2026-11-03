# Evidencia — D-08 Modelo de clases

| Dato | Valor |
| --- | --- |
| Diagrama | `modelo-clases.html` (fuente `candidate.json`) |
| Tipo Archify | `class`, perfil de calidad `showcase` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado en la 1.ª ejecución: `validate`, `deliver`, `check`, `browser-check` (`modelo-clases.finalize.json`) |
| Capturas | `visual-check/` (1440×900 y 2048×1320, tema claro y oscuro) |
| Sección del informe | Anexo N.º 6 |

## Criterio de inclusión

Se relevaron todas las declaraciones `class`, `interface` y `type` exportadas de `backend/src` y las clases de `backend-ia/app`. El backend principal está organizado en módulos de funciones: controladores y servicios exportan funciones, no clases. Solo hay cinco clases en `backend/src`: `AppError`, `SmtpMailSender`, `ConsoleMailSender`, `FakePaymentProvider` y `CodeMismatch` (`backend/src/services/two-factor/verify.ts:59`, interna, omitida). En `backend-ia`, servicios y pipeline también son funciones; sus clases son modelos Pydantic, modelos SQLAlchemy, un `dataclass` y una excepción. Por eso el modelo representa puertos, adaptadores y tipos de datos de negocio, no servicios.

Se omitieron los tipos derivados de Zod (`z.infer<...>` en `backend/src/validators/`), los tipos de Prisma (`Prisma.*GetPayload`), las interfaces internas no exportadas de consultas SQL (`AdRow`, `LocationRow`, `NearbyRecipientRow` y similares), las interfaces de eventos de Socket.IO y el frontend.

## Fuentes y verificación por tipo

| Tipo | Clase | Evidencia | Relaciones dibujadas y su evidencia |
| --- | --- | --- | --- |
| `MailSender` | interface | `backend/src/services/mail/mail-sender.ts:8-15` | — |
| `SmtpMailSender` | class | `backend/src/services/mail/smtp-mail-sender.ts:13-34` | Realización de `MailSender` (`implements`, `:13`); asociación con `SmtpConfig` (`private readonly config`, `:16`) |
| `ConsoleMailSender` | class | `backend/src/services/mail/console-mail-sender.ts:9-25` | Realización de `MailSender` (`:9`); dependencia de `MailMessage` (`send`, `:10`) |
| `MailMessage` | interface | `backend/src/services/mail/mail-sender.ts:1-6` | — |
| `SmtpConfig` | interface | `backend/src/services/mail/smtp-mail-sender.ts:4-11` | — |
| `PaymentProvider` | interface | `backend/src/services/payments/payment-provider.ts:14-16` | — |
| `FakePaymentProvider` | class | `backend/src/services/payments/fake-payment-provider.ts:5-9` | Realización de `PaymentProvider` (`:5`); dependencias de `ChargeInput` y `ChargeResult` (`charge`, `:6`) |
| `ChargeInput`, `ChargeResult` | interface | `backend/src/services/payments/payment-provider.ts:2-12` | — |
| `AppError` | class | `backend/src/errors/app-error.ts:1-14` | `extends Error` (librería, indicado en subtítulo) |
| `AuthUser` | interface | `backend/src/services/session.service.ts:8-13` | — |
| `ReportRow` | interface | `backend/src/services/reports.service.ts:13-29` | Se muestran 10 de 15 campos |
| `ReportDTO` | interface | `backend/src/services/reports.service.ts:49-52` | Herencia de `ReportRow` (`extends Omit<ReportRow, "lat" \| "lng">`, `:49`); composición con `ReportTag` (campo `tag`, `:51`) |
| `ReportTag` | interface | `backend/src/services/reports.service.ts:31-36` | — |
| `MatchDTO` | interface | `backend/src/services/matching.service.ts:320-329` | — |
| `AdCounts` | interface | `backend/src/services/ad-events.service.ts:11-14` | — |
| `AdStats` | interface | `backend/src/services/ad-events.service.ts:16-20` | Herencia de `AdCounts` (`extends`, `:16`) |
| `PlanOffer` | interface | `backend/src/config/plans.ts:8-13` | — |
| `SubscribeResult` | interface | `backend/src/services/businesses.service.ts:143-147` | Referencia tipos Prisma `Business` y `Subscription` (no representados) |
| `Settings` | class | `backend-ia/app/config.py:4-23` | `BaseSettings` (librería) |
| `EmbeddingRequest`, `ImageAnalysisRequest` | class | `backend-ia/app/main.py:85-90` | `BaseModel` (librería) |
| `Base` | class | `backend-ia/app/models.py:14-15` | `DeclarativeBase` (librería) |
| `Report` (ORM) | class | `backend-ia/app/models.py:18-27` | Herencia de `Base` (`:18`) |
| `ReportEmbedding` (ORM) | class | `backend-ia/app/models.py:30-38` | Herencia de `Base` (`:30`); `report_id` es `ForeignKey("reports.id")` sin `relationship()`, por lo que no se dibuja asociación |
| `ImageAnalysis` | record | `backend-ia/app/services/image_analysis_service.py:30-34` | `@dataclass(frozen=True)` |
| `ImageUnavailableError` | class | `backend-ia/app/services/image_analysis_service.py:26-27` | `Exception` (librería) |

Puertos y fábricas: `getMailSender()` elige el adaptador según `SMTP_HOST` (`backend/src/services/mail/index.ts:29-52`); `getPaymentProvider()` devuelve `FakePaymentProvider` (`backend/src/services/payments/index.ts:8-14`); `subscribe()` recibe el puerto con ese valor por defecto (`backend/src/services/businesses.service.ts:150-161`). Se documentan en tarjetas porque son funciones, no tipos.

## Limitaciones

- El modelo es acotado por diseño del código: el backend no usa clases para servicios ni controladores.
- Las superclases de librería (`Error`, `BaseSettings`, `BaseModel`, `DeclarativeBase`, `Exception`) no se dibujan como tipos.
- Exportaciones: la CLI de Archify no genera SVG ni PNG del diagrama; la exportación SVG/PNG está disponible desde el botón "Exportar" del visor HTML. Las capturas PNG de `visual-check/` son evidencia de revisión, no exportaciones.
- Revisión visual: se inspeccionó `visual-check/modelo-clases.visual-check.2048x1320.light.png` (parte superior del lienzo); tipos, miembros y relaciones se leen. No se revisó perceptualmente la parte inferior ni el tema oscuro.
