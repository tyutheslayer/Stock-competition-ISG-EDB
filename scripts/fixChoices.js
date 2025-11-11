import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.choice.updateMany({
    where: { isCorrect: null },
    data: { isCorrect: false },
  });
  console.log(`✅ ${result.count} choix corrigés`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());