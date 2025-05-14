// Script to ensure the admin user exists in the database
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting admin user setup...');
    
    // Get admin credentials from environment variables
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      throw new Error('Admin email and password must be set in the .env file');
    }
    
    console.log(`Setting up admin user with email: ${adminEmail}`);
    
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    
    if (existingUser) {
      console.log('Admin user already exists. Updating password...');
      
      // Hash the password
      const hashedPassword = await hash(adminPassword, 10);
      
      // Update the user
      await prisma.user.update({
        where: { email: adminEmail },
        data: {
          password: hashedPassword,
          role: 'admin',
        },
      });
      
      console.log('Admin user updated successfully.');
    } else {
      console.log('Admin user does not exist. Creating new admin user...');
      
      // Hash the password
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
