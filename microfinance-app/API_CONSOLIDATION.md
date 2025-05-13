# API Route Consolidation Guide for Vercel Deployment

This guide explains how to consolidate multiple API routes into fewer files to stay within Vercel's Hobby plan limit of 12 serverless functions.

## The Challenge

Vercel's Hobby plan limits you to 12 serverless functions. In Next.js, each API route file becomes a separate serverless function, which can quickly exceed this limit in larger applications.

## Solution: Consolidated API Routes

By combining related API endpoints into single files with internal routing logic, you can significantly reduce the number of serverless functions while maintaining the same functionality.

## Implementation Pattern

### 1. Create a Handler Object

Group related functionality into a handler object with methods for each operation:

```typescript
// Handler functions for different actions
const handlers = {
  // Get all items
  async getAll(req: NextRequest) {
    // Implementation
  },
  
  // Get a single item
  async getById(req: NextRequest, id: number) {
    // Implementation
  },
  
  // Create a new item
  async create(req: NextRequest) {
    // Implementation
  },
  
  // Update an item
  async update(req: NextRequest) {
    // Implementation
  },
  
  // Delete an item
  async delete(req: NextRequest) {
    // Implementation
  },
};
```

### 2. Create HTTP Method Handlers

Implement the standard HTTP method handlers that route to the appropriate handler functions:

```typescript
// Main handler functions
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');
  
  if (action === 'special-action') {
    return handlers.specialAction(req);
  } else if (id) {
    return handlers.getById(req, parseInt(id));
  }
  
  return handlers.getAll(req);
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  
  if (action === 'custom-action') {
    return handlers.customAction(req);
  }
  
  return handlers.create(req);
}

export async function PUT(req: NextRequest) {
  return handlers.update(req);
}

export async function DELETE(req: NextRequest) {
  return handlers.delete(req);
}
```

## Example: Consolidated User API

Here's how to consolidate user-related endpoints (login, logout, register, profile) into a single API route:

```typescript
// app/api/user/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Handler functions
const handlers = {
  async login(req: NextRequest) {
    // Login implementation
  },
  
  async logout() {
    // Logout implementation
  },
  
  async me(req: NextRequest) {
    // Get current user implementation
  },
  
  async register(req: NextRequest) {
    // Register implementation
  },
};

// HTTP method handlers
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  
  if (action === 'me') {
    return handlers.me(req);
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  
  switch (action) {
    case 'login':
      return handlers.login(req);
    case 'logout':
      return handlers.logout();
    case 'register':
      return handlers.register(req);
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
```

## Client-Side Usage

Update your client-side API calls to use the new consolidated endpoints:

```typescript
// Before consolidation
const login = (email, password) => fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});

// After consolidation
const login = (email, password) => fetch('/api/user?action=login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
```

## Recommended Consolidation Groups

Group your API routes logically by domain:

1. **User API** (`/api/user`): Login, logout, register, profile
2. **Chit Funds API** (`/api/chit-funds`): CRUD operations, members, auctions
3. **Loans API** (`/api/loans`): CRUD operations, repayments, schedules
4. **Members API** (`/api/members`): CRUD operations
5. **Dashboard API** (`/api/dashboard`): Summary, activities, events, financial data

## Benefits

- Stay within Vercel's serverless function limits
- Improved organization of related functionality
- Reduced cold starts by consolidating related endpoints
- Simplified deployment and management

## Considerations

- Keep handler functions focused and maintainable
- Use clear naming conventions for actions
- Document the API structure for team members
- Consider adding API versioning if needed

By following this pattern, you can maintain a clean API structure while staying within Vercel's Hobby plan limits.
