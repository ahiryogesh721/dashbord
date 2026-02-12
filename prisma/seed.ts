import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const initialSalesReps = [
  {
    name: "Sarah Miller",
    email: "sarah.miller@example.com",
    phone: "+15550000001",
    maxOpenLeads: 80,
  },
  {
    name: "David Khan",
    email: "david.khan@example.com",
    phone: "+15550000002",
    maxOpenLeads: 80,
  },
];

async function main(): Promise<void> {
  for (const rep of initialSalesReps) {
    await prisma.salesRep.upsert({
      where: { email: rep.email },
      update: {
        name: rep.name,
        phone: rep.phone,
        maxOpenLeads: rep.maxOpenLeads,
        isActive: true,
      },
      create: {
        ...rep,
        isActive: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
