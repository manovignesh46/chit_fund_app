import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  try {
    // Get admin credentials from environment variables (required)
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Check if environment variables are set
    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the .env file');
    }

    const hashedPassword = await hash(adminPassword, 10);

    // Check if admin user already exists with the old email
    const oldAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    // Check if admin user already exists with the new email
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (oldAdmin) {
      // Update the old admin user with new credentials
      const updatedAdmin = await prisma.user.update({
        where: { id: oldAdmin.id },
        data: {
          email: adminEmail,
          password: hashedPassword,
        },
      });
      console.log('Admin user updated:', updatedAdmin);
    } else if (existingAdmin) {
      // Update just the password for the existing admin
      const updatedAdmin = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          password: hashedPassword,
        },
      });
      console.log('Admin password updated:', updatedAdmin);
    } else {
      // Create a new admin user
      const admin = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
        },
      });
      console.log('Admin user created:', admin);
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
