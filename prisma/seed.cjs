/* eslint-disable no-console */
/**
 * Prisma seed — EDB
 * - Settings (id=1)
 * - Cours EDB (13:00–13:30 Europe/Paris) => EventType.MINI_COURSE, Visibility.PUBLIC
 * - Session trading "Plus" (13:35–15:00 Europe/Paris) => EventType.PLUS_SESSION, Visibility.PLUS
 * - EDB Night placeholders (22:30–02:30 Europe/Paris) => EventType.EDB_NIGHT, Visibility.PLUS
 * - Partenariat GP 1h (exemple) => EventType.PARTNER_TALK, Visibility.PUBLIC
 */

const { PrismaClient, EventType, Visibility } = require('@prisma/client');
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

/**
 * True si la date UTC est en période CEST (UE DST).
 * DST: 01:00 UTC du dernier dimanche de mars → 01:00 UTC du dernier dimanche d’octobre.
 */
function isEuropeParisDST(utcDate) {
  const year = utcDate.getUTCFullYear();
  const marchLastSunday = lastSundayOfMonthUTC(year, 2); // mars
  const octLastSunday   = lastSundayOfMonthUTC(year, 9); // octobre

  const dstStart = new Date(marchLastSunday.getTime()); dstStart.setUTCHours(1, 0, 0, 0);
  const dstEnd   = new Date(octLastSunday.getTime());   dstEnd.setUTCHours(1, 0, 0, 0);

  return utcDate >= dstStart && utcDate < dstEnd;
}

/**
 * Construit une Date UTC à partir d’une date/heure **locale Europe/Paris**.
 * @param {string} ymd  - "YYYY-MM-DD"
 * @param {string} hm   - "HH:MM"
 */
function parisLocalToUTC(ymd, hm) {
  const [Y, M, D] = ymd.split('-').map(Number);
  const [h, m] = hm.split(':').map(Number);
  const provisionalUTC = new Date(Date.UTC(Y, M - 1, D, h, m, 0, 0));
  const offsetMinutes = isEuropeParisDST(provisionalUTC) ? 120 : 60; // CEST/CET
  return new Date(provisionalUTC.getTime() - offsetMinutes * 60 * 1000);
}

/* =========================
   Upsert Event (unique: title + startsAt)
   ========================= */

async function upsertEvent({
  title,
  description = null,
  startsAt,         // Date UTC
  endsAt = null,    // Date UTC | null
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

async function main() {
  // 1) Settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, tradingFeeBps: 0 },
  });
  console.log('✅ Settings ok');

  // 2) Cours EDB (jeudi 13:00–13:30 Europe/Paris) + session Plus (13:35–15:00)
  const courseDates = [
    '2025-10-23',
    '2025-11-13',
    '2025-11-20',
    '2025-12-04',
    '2025-12-11',
    '2026-01-15',
    '2026-01-22',
    '2026-01-29',
    '2026-02-26',
    '2026-03-05',
    '2026-03-19',
    '2026-03-26',
    '2026-04-02',
    '2026-04-23',
  ];

  for (const ymd of courseDates) {
    const start = parisLocalToUTC(ymd, '13:00');
    const end   = parisLocalToUTC(ymd, '13:30');

    await upsertEvent({
      title: 'Cours EDB',
      description: 'Mini-cours de 30 min (ouvert à tous).',
      startsAt: start,
      endsAt: end,
      type: EventType.MINI_COURSE,
      visibility: Visibility.PUBLIC,
    });

    const plusStart = parisLocalToUTC(ymd, '13:35');
    const plusEnd   = parisLocalToUTC(ymd, '15:00');

    await upsertEvent({
      title: 'Session Trading Plus',
      description: 'Session de trading après le cours (accès membres Plus).',
      startsAt: plusStart,
      endsAt: plusEnd,
      type: EventType.PLUS_SESSION,
      visibility: Visibility.PLUS,
    });
  }

  // 3) EDB Night — placeholders (1 jeudi / mois, 22:30–02:30 Europe/Paris)
  const edbNightDates = [
    '2025-11-27',
    '2025-12-18',
    '2026-01-22',
    '2026-03-26',
  ];
  for (const ymd of edbNightDates) {
    const startParis = parisLocalToUTC(ymd, '22:30');
    const end = new Date(startParis.getTime() + 4 * 60 * 60 * 1000); // ~02:30 locales (approx)

    await upsertEvent({
      title: 'EDB Night',
      description: 'Session de trading (Asian session) — Accès membres Plus.',
      startsAt: startParis,
      endsAt: end,
      type: EventType.EDB_NIGHT,
      visibility: Visibility.PLUS,
    });
  }

  // 4) Partenariat Gestion de Patrimoine — placeholder 1h (date ajustable)
  {
    const ymd = '2026-02-12'; // à confirmer
    const start = parisLocalToUTC(ymd, '14:00');
    const end   = parisLocalToUTC(ymd, '15:00');
    await upsertEvent({
      title: 'Introduction à la gestion de patrimoine (Partenariat)',
      description: "Intervention de 1h avec l'asso Gestion de Patrimoine.",
      startsAt: start,
      endsAt: end,
      type: EventType.PARTNER_TALK,
      visibility: Visibility.PUBLIC,
    });
  }

  console.log('✅ Events seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });