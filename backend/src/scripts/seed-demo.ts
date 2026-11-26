import "dotenv/config";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { getMatchingConfig } from "../config/matching";
import { prisma } from "../db/client";
import * as chatsService from "../services/chats.service";
import * as notificationPreferencesService from "../services/notification-preferences.service";
import * as reportsService from "../services/reports.service";
import * as storageService from "../services/storage.service";
import { checkAiService, checkR2 } from "./preflight-checks";
import {
  assertDemoSeedAllowed,
  checkDemoScores,
  DemoScores,
  loadDemoAssets,
  uploadDemoAssets,
  waitForReportStatus,
} from "./demo-seed";

// seed de demo (#371): uso: npm run seed:demo | docker compose exec backend node dist/scripts/seed-demo.js
const DOMAIN = "@demo.patitas.local";
// cubre los reintentos del Backend IA (1 s, 5 s, 30 s)
const PUBLISH_WAIT = { timeoutMs: 90_000, intervalMs: 500 };

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

async function assertServicesReady(): Promise<void> {
  for (const [name, outcome] of [["R2", await checkR2()], ["Backend IA", await checkAiService()]] as const) {
    if (outcome.status === "FAIL") throw new Error(`${name}: ${outcome.message}`);
  }
}

// borra todo lo de los usuarios demo (idempotencia)
async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const reports = await prisma.report.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const reportIds = reports.map((r) => r.id);
  const chats = await prisma.chat.findMany({
    where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }, { reportId: { in: reportIds } }] },
    select: { id: true },
  });
  const chatIds = chats.map((c) => c.id);

  await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
  await prisma.chat.deleteMany({ where: { id: { in: chatIds } } });
  await prisma.notification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { reportId: { in: reportIds } }] } });
  await prisma.reportFlag.deleteMany({ where: { OR: [{ userId: { in: ids } }, { reportId: { in: reportIds } }] } });
  await prisma.adFlag.deleteMany({ where: { userId: { in: ids } } });
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.pet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.business.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

interface DemoReport {
  user: User;
  petId?: number;
  type: "lost" | "found";
  title: string;
  description: string;
  imageUrl: string;
  address: string;
  lat: number;
  lng: number;
  eventDaysAgo: number;
}

// camino real: pending -> Backend IA -> embedding -> matching -> published
async function publishReport(r: DemoReport): Promise<number> {
  const report = await reportsService.create({
    userId: r.user.id,
    petId: r.petId,
    reportType: r.type,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    location: { lat: r.lat, lng: r.lng },
    locationAddress: r.address,
    eventDate: daysAgo(r.eventDaysAgo),
  });
  const status = await waitForReportStatus(
    async () => (await prisma.report.findUnique({ where: { id: report.id }, select: { status: true } }))?.status ?? null,
    PUBLISH_WAIT
  );
  if (status !== "published") throw new Error(`"${r.title}" quedó ${status}, no published`);
  console.log(`  publicado #${report.id} ${r.title}`);
  return report.id;
}

async function readScores(pair: [number, number], negative: [number, number]): Promise<DemoScores> {
  const pairMatch = await prisma.reportMatch.findUnique({
    where: { reportLostId_reportFoundId: { reportLostId: pair[0], reportFoundId: pair[1] } },
  });
  const negativeMatch = await prisma.reportMatch.findUnique({
    where: { reportLostId_reportFoundId: { reportLostId: negative[0], reportFoundId: negative[1] } },
  });
  const [row] = await prisma.$queryRaw<{ similarity: number }[]>`
    SELECT 1 - (a.embedding <=> b.embedding) AS similarity
    FROM report_embeddings a, report_embeddings b
    WHERE a.report_id = ${negative[0]} AND b.report_id = ${negative[1]}
  `;
  return {
    pair: pairMatch?.similarityScore ?? null,
    negative: row ? Number(row.similarity) : null,
    negativeMatched: negativeMatch !== null,
  };
}

async function main(): Promise<void> {
  const password = assertDemoSeedAllowed();
  await assertServicesReady();
  const img = await uploadDemoAssets(loadDemoAssets(), storageService);
  const url = (file: string) => {
    const value = img.get(file);
    if (!value) throw new Error(`Falta ${file} en demo-assets`);
    return value;
  };
  await cleanup();

  // usuarios
  const passwordHash = await bcrypt.hash(password, 12);
  const mkUser = (local: string, fullName: string, phone: string, role: "usuario_regular" | "moderador" = "usuario_regular") =>
    prisma.user.create({
      data: { email: `${local}${DOMAIN}`, passwordHash, fullName, phone, role, emailVerifiedAt: new Date(), createdAt: daysAgo(40) },
    });
  const ana = await mkUser("ana", "Ana Gómez", "+54 260 455-1234");
  const bruno = await mkUser("bruno", "Bruno Pérez", "+54 260 466-9876");
  const carla = await mkUser("carla", "Carla Fernández", "+54 260 477-2468", "moderador");
  const diego = await mkUser("diego", "Diego Martínez", "+54 260 488-1357");
  const elena = await mkUser("elena", "Elena Ruiz", "+54 260 499-8642");

  // ubicación con consentimiento (San Rafael, zona piloto)
  for (const [u, latitude, longitude] of [[ana, -34.6177, -68.3301], [bruno, -34.6251, -68.3221], [elena, -34.6302, -68.3405]] as const) {
    await notificationPreferencesService.setLocationConsent(u.id, "accepted");
    await notificationPreferencesService.setLocation(u.id, { latitude, longitude });
  }

  // mascotas
  const toby = await prisma.pet.create({
    data: { userId: ana.id, name: "Toby", species: "dog", breed: "Perro de agua portugués", age: 4, color: "Negro con pecho blanco", description: "Muy sociable, collar rojo con chapita.", photoUrls: [url("toby-lost.jpg")], microchipId: "985112003456789" },
  });
  const mishi = await prisma.pet.create({
    data: { userId: ana.id, name: "Mishi", species: "cat", breed: "Común europeo", age: 2, color: "Atigrado", description: "Tímida, no sale de casa.", photoUrls: [url("mishi.jpg")] },
  });
  const lola = await prisma.pet.create({
    data: { userId: elena.id, name: "Lola", species: "dog", breed: "Border collie", age: 6, color: "Azul mirlo", description: "Responde a su nombre, muy asustadiza.", photoUrls: [url("lola-lost.jpg")] },
  });

  // perdidos primero: el matching de cada encontrado corre contra perdidos ya publicados
  console.log("Publicando reportes con el Backend IA...");
  const tobyLost = await publishReport({ user: ana, petId: toby.id, type: "lost", title: "Se perdió Toby, perro de agua negro", description: "Salió por el portón el sábado a la tarde. Tiene collar rojo con chapita. Muy manso.", imageUrl: url("toby-lost.jpg"), address: "Av. Hipólito Yrigoyen 500, San Rafael", lat: -34.6177, lng: -68.3301, eventDaysAgo: 3 });
  await publishReport({ user: elena, petId: lola.id, type: "lost", title: "Buscamos a Lola, border collie", description: "Se escapó durante la tormenta. Asustadiza, no la persigan.", imageUrl: url("lola-lost.jpg"), address: "Calle Bernardo de Irigoyen 1200, San Rafael", lat: -34.6302, lng: -68.3405, eventDaysAgo: 6 });
  await publishReport({ user: elena, type: "lost", title: "Perdimos a Pancho, salchicha", description: "Marrón, pelo corto, collar verde. Recompensa.", imageUrl: url("pancho-lost.jpg"), address: "Calle Chile 300, San Rafael", lat: -34.6098, lng: -68.328, eventDaysAgo: 1 });
  const mishiLost = await publishReport({ user: ana, petId: mishi.id, type: "lost", title: "Se perdió Mishi (ya apareció)", description: "Gracias a todos, Mishi volvió a casa.", imageUrl: url("mishi.jpg"), address: "Av. Hipólito Yrigoyen 500, San Rafael", lat: -34.6177, lng: -68.3301, eventDaysAgo: 15 });

  const tobyFound = await publishReport({ user: bruno, type: "found", title: "Encontré un perro negro en el parque", description: "Estaba suelto cerca del lago, con collar rojo. Lo tengo en casa.", imageUrl: url("toby-found.jpg"), address: "Parque Hipólito Yrigoyen, San Rafael", lat: -34.6205, lng: -68.327, eventDaysAgo: 2 });
  const goldenFound = await publishReport({ user: bruno, type: "found", title: "Golden encontrado en la plaza", description: "Macho joven, muy cariñoso, sin collar. Busca a su familia.", imageUrl: url("golden-found.jpg"), address: "Plaza San Martín, San Rafael", lat: -34.6141, lng: -68.3352, eventDaysAgo: 5 });
  const flagged = await publishReport({ user: diego, type: "found", title: "Salchicha de pelo largo en la terminal", description: "Manso, con hambre. Lo resguardo en mi casa.", imageUrl: url("dachshund-found.jpg"), address: "Terminal de ómnibus, San Rafael", lat: -34.6185, lng: -68.339, eventDaysAgo: 2 });

  await reportsService.close(mishiLost, ana.id);

  // el puntaje lo calcula el matching: el seed solo verifica
  const config = getMatchingConfig();
  const scores = await readScores([tobyLost, tobyFound], [tobyLost, goldenFound]);
  const problems = checkDemoScores(scores, config);
  console.log(`Par Toby (perdido #${tobyLost} / encontrado #${tobyFound}): ${scores.pair?.toFixed(3) ?? "sin coincidencia"}`);
  console.log(`Negativo Toby / golden #${goldenFound}: ${scores.negative?.toFixed(3) ?? "sin embedding"}`);
  if (problems.length > 0) throw new Error(`Calibración de la demo:\n  ${problems.join("\n  ")}`);

  // denuncias pendientes para moderación
  await prisma.reportFlag.create({ data: { reportId: flagged, userId: elena.id, reason: "false_info" } });
  await prisma.reportFlag.create({ data: { reportId: flagged, userId: bruno.id, reason: "duplicate" } });

  // chat: Bruno contacta a Ana por su reporte perdido
  const { chat } = await chatsService.createChat(bruno.id, ana.id, tobyLost);
  const msgs: [number, string][] = [
    [bruno.id, "Hola Ana, creo que el perro que encontré en el parque es Toby."],
    [ana.id, "¡Hola Bruno! ¿Tiene collar rojo con una chapita?"],
    [bruno.id, "Sí, dice \"Toby\" y un teléfono."],
    [ana.id, "¡Es él! ¿Paso a buscarlo esta tarde?"],
  ];
  for (const [sender, content] of msgs) {
    await chatsService.createMessage(chat.id, sender, { content });
  }

  // comercio premium con anuncios y métricas
  const vet = await prisma.business.create({
    data: {
      userId: diego.id, name: "Veterinaria Huellitas", cuit: "30-71234567-9", address: "Av. Bartolomé Mitre 250, San Rafael", phone: "+54 260 442-0000",
      category: "VETERINARIA", latitude: -34.615, longitude: -68.331, description: "Clínica veterinaria con guardia 24 hs, vacunación y peluquería.",
      website: "https://huellitas.example.com", socialLinks: ["https://instagram.com/huellitas.example"], plan: "PREMIUM", planExpiresAt: daysAgo(-25), createdAt: daysAgo(30),
    },
  });
  await prisma.subscription.create({
    data: { businessId: vet.id, period: "MONTHLY", amountUsd: 9.99, provider: "fake", reference: "demo-0001", status: "APPROVED", periodStart: daysAgo(5), periodEnd: daysAgo(-25), createdAt: daysAgo(5) },
  });
  const ad1 = await prisma.ad.create({ data: { businessId: vet.id, title: "Vacunación antirrábica gratis", body: "Todos los sábados de noviembre, de 9 a 13 hs.", imageUrl: url("golden-found.jpg"), radiusKm: 10, createdAt: daysAgo(5) } });
  const ad2 = await prisma.ad.create({ data: { businessId: vet.id, title: "20% off en baño y corte", body: "Presentando este anuncio en el local.", imageUrl: url("pancho-lost.jpg"), radiusKm: 5, status: "PAUSED", createdAt: daysAgo(4) } });
  await prisma.adFlag.create({ data: { adId: ad2.id, userId: elena.id, reason: "Información engañosa" } });

  const adEvents = [];
  for (let i = 0; i < 60; i++) adEvents.push({ adId: ad1.id, type: "impression" as const, placement: (i % 3 ? "feed" : "report_detail") as "feed" | "report_detail", createdAt: hoursAgo(i * 2) });
  for (let i = 0; i < 9; i++) adEvents.push({ adId: ad1.id, type: "click" as const, placement: "feed" as const, createdAt: hoursAgo(i * 11) });
  for (let i = 0; i < 20; i++) adEvents.push({ adId: ad2.id, type: "impression" as const, placement: "feed" as const, createdAt: hoursAgo(i * 4) });
  await prisma.adEvent.createMany({ data: adEvents });

  const bizEvents = [];
  for (let i = 0; i < 25; i++) bizEvents.push({ businessId: vet.id, type: "VIEW" as const, userId: i % 2 ? ana.id : null, createdAt: hoursAgo(i * 5) });
  for (let i = 0; i < 6; i++) bizEvents.push({ businessId: vet.id, type: "CONTACT" as const, userId: ana.id, createdAt: hoursAgo(i * 17) });
  await prisma.businessEvent.createMany({ data: bizEvents });

  // refugio gratuito
  await prisma.business.create({
    data: {
      userId: elena.id, name: "Refugio Patas Felices", cuit: "30-79876543-2", address: "Calle Las Heras 1500, San Rafael", phone: "+54 260 443-1111",
      category: "REFUGIO", latitude: -34.632, longitude: -68.325, description: "Refugio sin fines de lucro. Adopciones responsables.", createdAt: daysAgo(18),
    },
  });

  console.log("Datos de demo cargados (contraseña: SEED_DEMO_PASSWORD).");
  for (const u of [ana, bruno, carla, diego, elena]) console.log(`  ${u.email}  (${u.role})`);
}

main()
  .catch((error: unknown) => {
    console.error("Error al cargar los datos de demo:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
