// scripts/promote-admin.js
import prisma from "../lib/prisma.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/promote-admin.js email@example.com");
  process.exit(1);
}

const run = async () => {
  const user = await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  console.log("✅ Promu ADMIN:", user.email);
};
run().then(()=>process.exit(0)).catch(e => { console.error(e); process.exit(1); });
