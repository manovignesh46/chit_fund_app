// Script to ensure the admin user exists in the database
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const { randomBytes } = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

function generateRandomPassword() {
  return randomBytes(12).toString('base64url');
}

async function main() {
  try {
    console.log('Starting admin user setup...');

    // Admin email identifies the bootstrap account (not a secret).
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      throw new Error('Admin email must be set in the .env file');
    }

    console.log(`Setting up admin user with email: ${adminEmail}`);

    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      // Admin already exists — leave the password alone. Password changes
      // go through Settings, not this bootstrap script.
      if (existingUser.role !== 'admin') {
        await prisma.user.update({
          where: { email: adminEmail },
          data: { role: 'admin' },
        });
      }
      console.log('Admin user already exists, leaving password unchanged.');
    } else {
      console.log('Admin user does not exist. Creating new admin user...');

      // ADMIN_PASSWORD is only used for this one-time bootstrap — pass it
      // inline (e.g. `ADMIN_PASSWORD=temp npm run setup-admin`), it does not
      // need to live in .env. If omitted, a random password is generated.
      const adminPassword = process.env.ADMIN_PASSWORD || generateRandomPassword();
      const hashedPassword = await hash(adminPassword, 10);

      // Create the user
      await prisma.user.create({
        data: {
          name: 'Admin',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
        },
      });

      console.log('Admin user created successfully.');
      if (!process.env.ADMIN_PASSWORD) {
        console.log(`Generated temporary password: ${adminPassword}`);
        console.log('Log in and change it immediately from Settings.');
      }
    }
  } catch (error) {
    console.error('Error setting up admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('Admin setup completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error during admin setup:', error);
    process.exit(1);
  });
