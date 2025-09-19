/* eslint-disable no-console */
/**
 * Prisma seed — EDB
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

function isEuropeParisDST(utcDate) {
  const year = utcDate.getUTCFullYear();
  const marchLastSunday = lastSundayOfMonthUTC(year, 2);
  const octLastSunday = lastSundayOfMonthUTC(year, 9);
  const dstStart = new Date(marchLastSunday.getTime());
  dstStart.setUTCHours(1, 0, 0, 0);
  const dstEnd = new Date(octLastSunday.getTime());
  dstEnd.setUTCHours(1, 0, 0, 0);
  return utcDate >= dstStart && utcDate < dstEnd;
}

function parisLocalToUTC(ymd, hm) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, m] = hm.split(":").map(Number);
  const provisionalUTC = new Date(Date.UTC(Y, M - 1, D, h, m, 0, 0));
  const offsetMinutes = isEuropeParisDST(provisionalUTC) ? 120 : 60;
  return new Date(provisionalUTC.getTime() - offsetMinutes * 60 * 1000);
}

/* =========================
   Upsert Event
   ========================= */
async function upsertEvent({
  title,
  description = null,
  startsAt,
  endsAt = null,
  type = EventType.MINI_COURSE,
  visibility = Visibility.PUBLIC,
  location = null,
  isOpenEnded = false,
}) {
  return prisma.event.upsert({
    where: {
      title_startsAt: { title, startsAt },
    },
    update: {
      description,
      endsAt,
      type,
      visibility,
      location,
      isOpenEnded,
    },
    create: {
      title,
      description,
      startsAt,
      endsAt,
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
  // 1) Settings
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
    const start = parisLocalToUTC(ymd, "13:00");
    const end = parisLocalToUTC(ymd, "13:30");
    await upsertEvent({
      title: "Cours EDB",
      description: `Thème : ${theme}. Mini-cours de 30 min (ouvert à tous).`,
      startsAt: start,
      endsAt: end,
      type: EventType.MINI_COURSE,
      visibility: Visibility.PUBLIC,
    });

    const plusStart = parisLocalToUTC(ymd, "13:35");
    await upsertEvent({
      title: "Session Trading Plus",
      description:
        "Session de trading réservée aux membres « Plus » après le cours. Débute à 13h35 et peut se prolonger.",
      startsAt: plusStart,
      endsAt: null,
      type: EventType.PLUS_SESSION,
      visibility: Visibility.PLUS,
      isOpenEnded: true,
    });
  }

  // 3) EDB Night
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
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
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

  // 4) Partenariat Gestion de Patrimoine
  {
    const ymd = "2026-02-12";
    const start = parisLocalToUTC(ymd, "14:00");
    const end = parisLocalToUTC(ymd, "15:00");
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
  await upsertEvent({
    title: "Mastermind Crypto (TDB)",
    description:
      "Mastermind week-end pour apprendre à trader les cryptomonnaies. Date & lieu TDB.",
    startsAt: parisLocalToUTC("2026-06-06", "09:00"),
    endsAt: parisLocalToUTC("2026-06-07", "18:00"),
    type: EventType.MASTERMIND,
    visibility: Visibility.PLUS,
    location: "TDB",
  });

  await upsertEvent({
    title: "Road Trip Finance – Luxembourg (TDB)",
    description:
      "Road trip spécial finance au Luxembourg. Ouvert à tous les inscrits à l’École de la Bourse. Date TDB.",
    startsAt: parisLocalToUTC("2026-05-15", "08:00"),
    endsAt: parisLocalToUTC("2026-05-17", "20:00"),
    type: EventType.ROADTRIP,
    visibility: Visibility.PUBLIC,
    location: "Luxembourg – TDB",
  });

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