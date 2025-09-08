const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = 'demo@example.com';
  const pass = 'demo1234';
  const password = await bcrypt.hash(pass, 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password, name: 'Demo User' },
  });
  console.log(`Seeded demo user -> ${email} / ${pass}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
