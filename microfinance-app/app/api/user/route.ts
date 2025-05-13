import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { compare, hash } from 'bcrypt';
import { sign } from 'jsonwebtoken';

// Handler functions for different actions
const handlers = {
  // Login handler
  async login(req: NextRequest) {
    try {
      const body = await req.json();
      const { email, password } = body;

      // Validate required fields
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password are required' },
          { status: 400 }
        );
      }

      // Find the user by email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Check if user exists
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Check if the user is an admin
      if (user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Access denied. Only administrators can log in.' },
          { status: 403 }
        );
      }

      // Verify password
      const passwordMatch = await compare(password, user.password);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Get JWT secret from environment variable
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET must be set in the .env file');
      }

      // Create JWT token
      const token = sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        jwtSecret,
        { expiresIn: '1d' }
      );

      // Create a response with user data
      const response = NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });

      // Set the token in a cookie
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
        sameSite: 'strict',
      });

      return response;
    } catch (error: any) {
      console.error('Login error:', error);
      return NextResponse.json(
        { error: 'An error occurred during login' },
        { status: 500 }
      );
    }
  },

  // Logout handler
  async logout() {
    try {
      // Create a response
      const response = NextResponse.json({ success: true });

      // Clear the auth token cookie
      response.cookies.set({
        name: 'auth_token',
        value: '',
        expires: new Date(0),
        path: '/',
      });

      return response;
    } catch (error) {
      console.error('Logout error:', error);
      return NextResponse.json(
        { error: 'An error occurred during logout' },
        { status: 500 }
      );
    }
  },

  // Get current user handler
  async me(req: NextRequest) {
    try {
      // Get the token from cookies
      const token = req.cookies.get('auth_token')?.value;

      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Get JWT secret from environment variable
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET must be set in the .env file');
      }

      // Verify the token
      const decoded = verify(token, jwtSecret) as {
        id: number;
        email: string;
        role: string;
      };

      // Get the user from the database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Return the user data
      return NextResponse.json(user);
    } catch (error) {
      console.error('Auth check error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  },

  // Register handler (if needed)
  async register(req: NextRequest) {
    try {
      const body = await req.json();
      const { name, email, password } = body;

      // Validate required fields
      if (!name || !email || !password) {
        return NextResponse.json(
          { error: 'Name, email, and password are required' },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        );
      }

      // Hash the password
      const hashedPassword = await hash(password, 10);

      // Create the user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'user', // Default role
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return NextResponse.json(user, { status: 201 });
    } catch (error) {
      console.error('Registration error:', error);
      return NextResponse.json(
        { error: 'An error occurred during registration' },
        { status: 500 }
      );
    }
  },
};

// Main handler function
export async function POST(req: NextRequest) {
  // Get the action from the query parameter
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
  
    // Route to the appropriate handler based on action
    switch (action) {
      case 'login':
        return handlers.login(req);
      case 'logout':
        return handlers.logout();
      case 'register':
        return handlers.register(req);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }

}

// GET handler for user info
export async function GET(req: NextRequest) {
  // Get the action from the query parameter
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'me') {
    return handlers.me(req);
  }

  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  );
}

// Import verify from jsonwebtoken
import { verify } from 'jsonwebtoken';
