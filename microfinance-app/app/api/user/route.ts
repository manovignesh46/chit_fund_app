import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { compare, hash } from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { isPrimaryAdmin, getActorUserId } from '../../../lib/auth';
import { findPartnerLoginUser, getLoginPartners, findUserByEmailOrUsername } from '../../../lib/partnerLogins';

async function createAuthSession(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  partnerId: number | null;
  dataOwnerId: number | null;
  partner?: { id: number; name: string } | null;
}) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set in the .env file');
  }

  const dataOwnerId = user.dataOwnerId ?? user.id;
  const secret = new TextEncoder().encode(jwtSecret);
  const token = await new SignJWT({
    id: dataOwnerId,
    actorId: user.id,
    partnerId: user.partnerId,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(secret);

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    partnerId: user.partnerId,
    dataOwnerId: user.dataOwnerId,
    isPrimaryAdmin: user.role === 'admin' && !user.dataOwnerId,
    partnerLocked: !!user.partnerId,
    partner: user.partner ?? null,
  });

  response.cookies.set({
    name: 'auth_token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    path: '/',
    sameSite: 'strict',
  });

  return response;
}

// Handler functions for different actions
const handlers = {
  // Get partners handler
  async getPartners(req: NextRequest) {
    try {
      const token = req.cookies.get('auth_token')?.value;

      if (!token) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('JWT_SECRET must be set in the .env file');
        }

        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);
      
        const partners = await prisma.partner.findMany({
          where: {
            createdById: payload.id,
            isActive: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        return NextResponse.json({ partners });
      } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
    }
  },

  // Login handler — accepts email or username (partner name)
  async login(req: NextRequest) {
    try {
      const body = await req.json();
      const { email, password } = body;
      const identifier = email?.trim();

      if (!identifier || !password) {
        return NextResponse.json(
          { error: 'Username/email and password are required' },
          { status: 400 }
        );
      }

      const user = await findUserByEmailOrUsername(identifier);

      if (!user) {
        return NextResponse.json(
          { error: 'Invalid username/email or password' },
          { status: 401 }
        );
      }

      if (user.role !== 'admin' && user.role !== 'partner') {
        return NextResponse.json(
          { error: 'Access denied. Only authorized users can log in.' },
          { status: 403 }
        );
      }

      const passwordMatch = await compare(password, user.password);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Invalid username/email or password' },
          { status: 401 }
        );
      }

      return createAuthSession(user);
    } catch (error: any) {
      console.error('Login error:', error);
      return NextResponse.json(
        { error: 'An error occurred during login' },
        { status: 500 }
      );
    }
  },

  // Partner-specific login (select partner + password)
  async partnerLogin(req: NextRequest) {
    try {
      const body = await req.json();
      const { partnerId, password } = body;

      if (!partnerId || !password) {
        return NextResponse.json(
          { error: 'Partner and password are required' },
          { status: 400 }
        );
      }

      const user = await findPartnerLoginUser(parseInt(partnerId));
      if (!user) {
        return NextResponse.json(
          { error: 'Partner login not found' },
          { status: 404 }
        );
      }

      const passwordMatch = await compare(password, user.password);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }

      return createAuthSession(user);
    } catch (error) {
      console.error('Partner login error:', error);
      return NextResponse.json(
        { error: 'An error occurred during login' },
        { status: 500 }
      );
    }
  },

  // Public: list partners available for login
  async getLoginPartnersList() {
    try {
      const partners = await getLoginPartners();
      return NextResponse.json({ partners });
    } catch (error) {
      console.error('Error fetching login partners:', error);
      return NextResponse.json({ error: 'Failed to load partners' }, { status: 500 });
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
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);

      const userId = Number(payload.actorId ?? payload.id);

      // Get the user from the database (basic fields always available)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          partnerId: true,
          dataOwnerId: true,
          partner: {
            select: { id: true, name: true },
          },
        },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Return the user data
      return NextResponse.json({
        ...user,
        dataOwnerId: payload.id,
        isPrimaryAdmin: user.role === 'admin' && !user.dataOwnerId,
        partnerLocked: !!user.partnerId,
      });
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

      // Create the user with partners in a transaction
      const user = await prisma.$transaction(async (prisma) => {
        // Create the user
        const newUser = await prisma.user.create({
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

        // Create default partners for the user
        const defaultPartners = ['Me', 'My Friend'];
        await Promise.all(
          defaultPartners.map((name) =>
            prisma.partner.create({
              data: {
                name,
                isActive: true,
                createdById: newUser.id,
              },
            })
          )
        );

        return newUser;
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

  async listUsers(req: NextRequest) {
    try {
      if (!(await isPrimaryAdmin(req))) {
        return NextResponse.json({ error: 'Only the primary admin can manage users' }, { status: 403 });
      }

      const token = req.cookies.get('auth_token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET must be set in the .env file');
      }

      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      const actorId = (payload.actorId ?? payload.id) as number;

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { id: actorId },
            { dataOwnerId: actorId },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          partnerId: true,
          dataOwnerId: true,
          createdAt: true,
          partner: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({ users });
    } catch (error) {
      console.error('Error listing users:', error);
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
    }
  },

  async createUser(req: NextRequest) {
    try {
      if (!(await isPrimaryAdmin(req))) {
        return NextResponse.json({ error: 'Only the primary admin can create users' }, { status: 403 });
      }

      const token = req.cookies.get('auth_token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET must be set in the .env file');
      }

      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      const primaryAdminId = (payload.actorId ?? payload.id) as number;

      const body = await req.json();
      const { name, email, password, partnerId, role = 'partner' } = body;

      if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
      }

      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }

      if (role !== 'partner' && role !== 'admin') {
        return NextResponse.json({ error: 'Role must be partner or admin' }, { status: 400 });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
      }

      if (partnerId) {
        const partner = await prisma.partner.findFirst({
          where: { id: parseInt(partnerId), createdById: primaryAdminId },
        });
        if (!partner) {
          return NextResponse.json({ error: 'Partner not found' }, { status: 400 });
        }

        const existingPartnerUser = await prisma.user.findFirst({
          where: { partnerId: partner.id },
        });
        if (existingPartnerUser) {
          return NextResponse.json({ error: 'This partner already has a login account' }, { status: 409 });
        }
      }

      const hashedPassword = await hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          partnerId: partnerId ? parseInt(partnerId) : null,
          dataOwnerId: role === 'partner' ? primaryAdminId : null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          partnerId: true,
          partner: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
      console.error('Error creating user:', error);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  },

  async deleteUser(req: NextRequest) {
    try {
      if (!(await isPrimaryAdmin(req))) {
        return NextResponse.json({ error: 'Only the primary admin can delete users' }, { status: 403 });
      }

      const body = await req.json();
      const { userId } = body;

      if (!userId) {
        return NextResponse.json({ error: 'User id is required' }, { status: 400 });
      }

      const token = req.cookies.get('auth_token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET must be set in the .env file');
      }

      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret);
      const primaryAdminId = (payload.actorId ?? payload.id) as number;

      const userToDelete = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
      });

      if (!userToDelete) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (userToDelete.id === primaryAdminId) {
        return NextResponse.json({ error: 'Cannot delete the primary admin account' }, { status: 400 });
      }

      if (userToDelete.dataOwnerId !== primaryAdminId) {
        return NextResponse.json({ error: 'You can only delete users in your organization' }, { status: 403 });
      }

      await prisma.user.delete({ where: { id: userToDelete.id } });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
  },

  // Change the logged-in user's own password
  async changePassword(req: NextRequest) {
    try {
      const actorId = await getActorUserId(req);
      if (!actorId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const body = await req.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({ where: { id: actorId } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const passwordMatch = await compare(currentPassword, user.password);
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      const hashedPassword = await hash(newPassword, 10);
      await prisma.user.update({
        where: { id: actorId },
        data: { password: hashedPassword },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error changing password:', error);
      return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
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
      case 'partner-login':
        return handlers.partnerLogin(req);
      case 'logout':
        return handlers.logout();
      case 'register':
        return handlers.register(req);
      case 'create-user':
        return handlers.createUser(req);
      case 'delete-user':
        return handlers.deleteUser(req);
      case 'change-password':
        return handlers.changePassword(req);
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
// Main route handler
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'me':
        return await handlers.me(req);
      case 'partners':
        return await handlers.getPartners(req);
      case 'list-users':
        return await handlers.listUsers(req);
      case 'login-partners':
        return await handlers.getLoginPartnersList();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}


