// Script to verify JWT token and authentication flow
const { sign, verify } = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting authentication verification...');
    
    // Get JWT secret from environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be set in the .env file');
    }
    
    console.log('JWT_SECRET is set:', jwtSecret.substring(0, 3) + '...' + jwtSecret.substring(jwtSecret.length - 3));
    
    // Get admin credentials from environment variables
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      throw new Error('Admin email and password must be set in the .env file');
    }
    
    console.log(`Admin email is set: ${adminEmail}`);
    console.log(`Admin password is set: ${adminPassword.substring(0, 3) + '...'}`);
    
    // Check if admin user exists in the database
    const user = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    
    if (!user) {
      console.log('Admin user does not exist in the database.');
      return;
    }
    
    console.log('Admin user found in the database:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    
    // Create a test JWT token
    const token = sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '1h' }
    );
    
    console.log('Test JWT token created successfully.');
    
    // Verify the token
    try {
      const decoded = verify(token, jwtSecret);
      console.log('Token verification successful:', decoded);
    } catch (error) {
      console.error('Token verification failed:', error);
      throw error;
    }
    
    console.log('Authentication verification completed successfully.');
  } catch (error) {
    console.error('Error during authentication verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error during verification:', error);
    process.exit(1);
  });
