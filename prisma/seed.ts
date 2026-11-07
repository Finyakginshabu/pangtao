import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);
const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash(SEED_DEFAULT_PASSWORD, BCRYPT_COST);

  const seedUsers = [
    {
      email: 'admin@example.test',
      displayName: 'System Admin',
      role: Role.ADMIN,
      isActive: true,
    },
    {
      email: 'alice@example.test',
      displayName: 'Alice User',
      role: Role.USER,
      isActive: true,
    },
    {
      email: 'bob@example.test',
      displayName: 'Bob User',
      role: Role.USER,
      isActive: true,
    },
  ];

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        passwordHash,
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        passwordHash,
      },
    });
  }

  console.log('✅ Seed complete: 3 users created/updated.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

