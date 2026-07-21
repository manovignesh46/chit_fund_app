import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import * as dotenv from 'dotenv';
import { randomBytes } from 'crypto';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

function generateRandomPassword(): string {
  return randomBytes(12).toString('base64url');
}

async function main() {
  try {
    // Admin email identifies the bootstrap account (not a secret).
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      throw new Error('ADMIN_EMAIL must be set in the .env file');
    }

    // Check if admin user already exists with the old email
    const oldAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    // Check if admin user already exists with the new email
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (oldAdmin) {
      // Rename the old admin user to the new email; leave their password untouched
      // (they may have already changed it via Settings).
      const updatedAdmin = await prisma.user.update({
        where: { id: oldAdmin.id },
        data: { email: adminEmail },
      });
      console.log('Admin user renamed:', updatedAdmin.email);
    } else if (existingAdmin) {
      // Admin already exists — nothing to do. Password changes go through
      // Settings, not the seed script, so we never touch it here.
      console.log('Admin user already exists, leaving password unchanged:', existingAdmin.email);
    } else {
      // No admin yet: create one. ADMIN_PASSWORD is only needed for this
      // one-time bootstrap — pass it inline (e.g. `ADMIN_PASSWORD=temp npm run seed`),
      // it does not need to live in .env. If omitted, a random password is
      // generated and printed once so you can log in and set your own via Settings.
      const adminPassword = process.env.ADMIN_PASSWORD || generateRandomPassword();
      const hashedPassword = await hash(adminPassword, 10);

      const admin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
        },
      });
      console.log('Admin user created:', admin.email);
      if (!process.env.ADMIN_PASSWORD) {
        console.log(`Generated temporary password: ${adminPassword}`);
        console.log('Log in and change it immediately from Settings.');
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
