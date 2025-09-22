/* eslint-disable no-console */
/**
 * Prisma seed — EDB
 * - Corrige les enums Postgres si besoin (Visibility, EventType)
 * - Crée la table AppSettings si absente
 * - Upsert Settings (id=1)
 * - Seed des évènements (PLUS_SESSION avec endsAt != null pour éviter la contrainte NOT NULL)
 */

const { PrismaClient, EventType, Visibility } = require("@prisma/client");
const prisma = new PrismaClient();

/* =========================
   Utils Europe/Paris → UTC
   ========================= */

/** Dernier dimanche d'un mois (0-based) à 00:00 UTC */
function lastSundayOfMonthUTC(year, monthIndex0) {
  const d = new Date(Date.UTC(year, monthIndex0 + 1, 1, 0, 0, 0, 0));
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** True si l’UTC donné tombe dans la période CEST (DST Europe/Paris) */
function isEuropeParisDST(utcDate) {
  const year = utcDate.getUTCFullYear();
  const marchLastSunday = lastSundayOfMonthUTC(year, 2); // mars
  const octLastSunday   = lastSundayOfMonthUTC(year, 9); // octobre
  const dstStart = new Date(marchLastSunday.getTime()); dstStart.setUTCHours(1, 0, 0, 0);
  const dstEnd   = new Date(octLastSunday.getTime());   dstEnd.setUTCHours(1, 0, 0, 0);
  return utcDate >= dstStart && utcDate < dstEnd;
}

/** Construit une Date UTC à partir d’une date/heure locale Europe/Paris */
function parisLocalToUTC(ymd, hm) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, m] = hm.split(":").map(Number);
  const provisionalUTC = new Date(Date.UTC(Y, M - 1, D, h, m, 0, 0));
  const offsetMinutes = isEuropeParisDST(provisionalUTC) ? 120 : 60; // CEST/CET
  return new Date(provisionalUTC.getTime() - offsetMinutes * 60 * 1000);
}

/* =========================
   Préflight DB (enums & table)
   ========================= */

/** Ajoute une valeur à un enum Postgres si elle n’existe pas. */
async function ensurePgEnumValue(enumTypeName, value) {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = '${enumTypeName}'
          AND e.enumlabel = '${value}'
      ) THEN
        EXECUTE 'ALTER TYPE "${enumTypeName}" ADD VALUE ''${value}''';
      END IF;
    END$$;
  `);
}

/** S’assure que toutes les valeurs nécessaires existent dans l’enum Postgres donné. */
async function ensurePgEnumValues(enumTypeName, values) {
  for (const v of values) {
    await ensurePgEnumValue(enumTypeName, v);
  }
}

/** Crée la table AppSettings si absente (schema Settings mappé dessus). */
async function ensureAppSettingsExists() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppSettings" (
      id INTEGER PRIMARY KEY,
      "feeBps" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/* =========================
   Upsert Event (unique: title+startsAt)
   ========================= */
async function upsertEvent({
  title,
  description = null,
  startsAt,
  endsAt = null,           // ⚠️ ta DB actuelle impose NOT NULL : on veillera à passer une valeur
  type = EventType.MINI_COURSE,
  visibility = Visibility.PUBLIC,
  location = null,
  isOpenEnded = false,
}) {
  // Par sécurité, si endsAt est null, pose une fin par défaut +1h
  const safeEndsAt = endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);

  return prisma.event.upsert({
    where: {
      title_startsAt: { title, startsAt },
    },
    update: {
      description,
      endsAt: safeEndsAt,
      type,
      visibility,
      location,
      isOpenEnded,
    },
    create: {
      title,
      description,
      startsAt,
      endsAt: safeEndsAt,
      type,
      visibility,
      location,
      isOpenEnded,
    },
  });
}

/* =========================
   Seed principal
   ========================= */
async function main() {
  // 0) Robustesse : enums & table physiques
  await ensurePgEnumValues("Visibility", ["PUBLIC", "PLUS"]);
  await ensurePgEnumValues("EventType", [
    "MINI_COURSE",
    "PLUS_SESSION",
    "EDB_NIGHT",
    "PARTNER_TALK",
    "MASTERMIND",
    "ROADTRIP",
    "OTHER",
  ]);
  await ensureAppSettingsExists();

  // 1) Settings (id=1)
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tradingFeeBps: 0 },
  });
  console.log("✅ Settings ok");

  // 2) Cours EDB + sessions Plus
  const MINI_COURSES = [
    ["2025-10-23", "Introduction aux marchés financiers"],
    ["2025-11-13", "Choisir un courtier, frais & exécution"],
    ["2025-11-20", "Carnet d’ordres & types d’ordres"],
    ["2025-12-04", "ETF & construction d’allocation"],
    ["2025-12-11", "Analyse fondamentale : comptes & ratios clés"],
    ["2026-01-15", "Analyse technique I : tendances, supports, MME"],
    ["2026-01-22", "Risk management & sizing des positions"],
    ["2026-01-29", "Psychologie du trader & journal de bord"],
    ["2026-02-26", "Macro & cycles (taux, inflation, croissance)"],
    ["2026-03-05", "Options (basics) : calls, puts, risques"],
    ["2026-03-19", "Stratégies : momentum, breakout, mean-reversion"],
    ["2026-03-26", "Diversification, corrélations & hedging"],
    ["2026-04-02", "Portefeuille core + satellites (mise en pratique)"],
    ["2026-04-23", "Bilan, métriques de perf & prochaines étapes"],
  ];

  for (const [ymd, theme] of MINI_COURSES) {
    // Cours 13:00 → 13:30
    const start = parisLocalToUTC(ymd, "13:00");
    const end   = parisLocalToUTC(ymd, "13:30");
    await upsertEvent({
      title: "Cours EDB",
      description: `Thème : ${theme}. Mini-cours de 30 min (ouvert à tous).`,
      startsAt: start,
      endsAt: end,
      type: EventType.MINI_COURSE,
      visibility: Visibility.PUBLIC,
    });

    // Session Plus 13:35 → on indique +3h pour respecter NOT NULL (et on marque open-ended)
    const plusStart = parisLocalToUTC(ymd, "13:35");
    const plusEnd   = new Date(plusStart.getTime() + 3 * 60 * 60 * 1000);
    await upsertEvent({
      title: "Session Trading Plus",
      description:
        "Session de trading réservée aux membres « Plus » après le cours. Démarre à 13h35 et peut se prolonger.",
      startsAt: plusStart,
      endsAt: plusEnd,
      type: EventType.PLUS_SESSION,
      visibility: Visibility.PLUS,
      isOpenEnded: true,
    });
  }

  // 3) EDB Night (jeudi, 22:30 → 02:30 locales ~ +4h)
  const EDB_NIGHTS = [
    "2025-10-23",
    "2025-11-13",
    "2025-12-11",
    "2026-01-22",
    "2026-02-26",
    "2026-03-19",
    "2026-04-23",
  ];
  for (const ymd of EDB_NIGHTS) {
    const start = parisLocalToUTC(ymd, "22:30");
    const end   = new Date(start.getTime() + 4 * 60 * 60 * 1000); // ~02:30
    await upsertEvent({
      title: "EDB Night",
      description:
        "Session de trading (Asian session) réservée aux membres « Plus ». 22h30 → 02h30.",
      startsAt: start,
      endsAt: end,
      type: EventType.EDB_NIGHT,
      visibility: Visibility.PLUS,
    });
  }

  // 4) Partenariat Gestion de Patrimoine — 1h (placeholder)
  {
    const ymd = "2026-02-12"; // ajustable quand tu as la date
    const start = parisLocalToUTC(ymd, "14:00");
    const end   = parisLocalToUTC(ymd, "15:00");
    await upsertEvent({
      title: "Introduction à la gestion de patrimoine (Partenariat)",
      description: "Intervention de 1h avec l'asso Gestion de Patrimoine.",
      startsAt: start,
      endsAt: end,
      type: EventType.PARTNER_TALK,
      visibility: Visibility.PUBLIC,
    });
  }

  // 5) Événements spéciaux (TDB)
  {
    const start = parisLocalToUTC("2026-06-06", "09:00");
    const end   = parisLocalToUTC("2026-06-07", "18:00");
    await upsertEvent({
      title: "Mastermind Crypto (TDB)",
      description:
        "Mastermind week-end pour apprendre à trader les cryptomonnaies. Date & lieu TDB.",
      startsAt: start,
      endsAt: end,
      type: EventType.MASTERMIND,
      visibility: Visibility.PLUS,
      location: "TDB",
    });
  }

  {
    const start = parisLocalToUTC("2026-05-15", "08:00");
    const end   = parisLocalToUTC("2026-05-17", "20:00");
    await upsertEvent({
      title: "Road Trip Finance – Luxembourg (TDB)",
      description:
        "Road trip spécial finance au Luxembourg. Ouvert à tous les inscrits à l’École de la Bourse. Date TDB.",
      startsAt: start,
      endsAt: end,
      type: EventType.ROADTRIP,
      visibility: Visibility.PUBLIC,
      location: "Luxembourg – TDB",
    });
  }

  console.log("✅ Events seeded");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });