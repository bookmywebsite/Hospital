import { prisma } from '@/lib/prisma';

async function main() {
  const result = await prisma.scheduledJob.deleteMany({
    where: { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
  });
  console.log('Deleted jobs:', result.count);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
