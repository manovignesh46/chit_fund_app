Architecture Revamp Plan: Microfinance Application
Overview
This plan addresses the critical architectural issues in the current microfinance application by:

✅ Simplifying the Transaction model (remove redundant partner tracking fields)
✅ Adding explicit credit/debit classification
✅ Creating dedicated balance tracking system
✅ Making fee structures reusable across chit funds
✅ Improving query performance and data integrity
User Review Required
IMPORTANT

Breaking Changes This revamp will modify the database schema significantly. While we'll maintain backward compatibility where possible, some API changes may be required.

WARNING

Data Migration Required Existing transaction data will need to be migrated to the new schema. A migration script will be provided to handle this automatically.

CAUTION

Verification Scope The user should decide whether to:

Implement this as a complete rewrite on a new branch
Incrementally migrate existing system
Create new database and migrate historical data
Proposed Changes
Component 1: Simplified Transaction Model
[MODIFY] 
schema.prisma
Changes to Transaction Model:

model Transaction {
  id                Int       @id @default(autoincrement())
  type              String
  amount            Float
+ transactionClass String    // 'CREDIT' or 'DEBIT'
  
- // ❌ Remove redundant string fields
- from_partner      String?
- to_partner        String?
- action_performer  String
- entered_by        String
  
- // ❌ Remove denormalized balance fields
- partnerBalance    Float?    @default(0)
- totalBalance      Float?    @default(0)
  
+ // ✅ Simplified partner tracking
+ partnerId         Int?      // The partner performing/recording this transaction
  
  date              DateTime
  note              String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  createdById       Int
  
  // Relations
  createdBy         User      @relation(fields: [createdById], references: [id])
+ partner           Partner?  @relation(fields: [partnerId], references: [id])
  
- // Remove old from/to partner relations
- fromPartner       Partner?  @relation("FromPartnerTransactions")
- toPartner         Partner?  @relation("ToPartnerTransactions")
  
  // Linked entities
  repayment         Repayment?
  contribution      Contribution?
  auction           Auction?
  loan              Loan?
  
+ @@index([partnerId])
+ @@index([transactionClass])
  @@index([type])
  @@index([date])
}
New Transaction Structure:

// Example: Loan disbursement
{
  type: 'LOAN_DISBURSEMENT',
  amount: 9800,
  transactionClass: 'DEBIT',      // ✅ Explicit classification
  partnerId: 1,                    // Partner A disbursed the loan
  date: '2024-01-10',
  note: 'Loan to Rajesh Kumar'
}
// Example: Loan repayment
{
  type: 'LOAN_REPAYMENT',
  amount: 3300,
  transactionClass: 'CREDIT',     // ✅ Explicit classification
  partnerId: 1,                    // Partner A collected repayment
  date: '2024-02-10',
  note: 'Repayment from Rajesh Kumar - Period 1'
}
// Example: Partner to Partner Transfer
// Now creates ONE transaction, not two
{
  type: 'PARTNER_TO_PARTNER',
  amount: 5000,
  transactionClass: 'TRANSFER',    // ✅ Special classification for internal transfers
  partnerId: 1,                     // Partner A initiated transfer
  note: 'Transfer from Partner A to Partner B',
  metadata: {                       // Store additional context
    fromPartnerId: 1,
    toPartnerId: 2
  }
}
Benefits:

✅ Reduces 8 partner-tracking fields to 1
✅ Explicit credit/debit makes querying simple: WHERE transactionClass = 'CREDIT'
✅ No denormalized balance fields to maintain
✅ Clearer data model, easier to understand
Component 2: Dedicated Balance Tracking System
[NEW] Add PartnerBalance Model
New table for tracking balances:

model PartnerBalance {
  id              Int       @id @default(autoincrement())
  partnerId       Int
  balance         Float     @default(0)
  lastUpdated     DateTime  @default(now())
  lastTransactionId Int?    // Last transaction that updated this balance
  createdById     Int
  
  partner         Partner   @relation(fields: [partnerId], references: [id])
  createdBy       User      @relation(fields: [createdById], references: [id])
  lastTransaction Transaction? @relation(fields: [lastTransactionId], references: [id])
  
  @@unique([partnerId, createdById])
  @@index([partnerId])
  @@index([createdById])
}
How It Works:

Single Source of Truth: One row per partner stores their current balance
Transaction Updates: When a transaction is created, update the balance
Efficient Queries: Get current balance with simple query: SELECT balance FROM PartnerBalance WHERE partnerId = ?
Example Flow:

// Initial state
PartnerBalance { partnerId: 1, balance: 50000 }
// After loan disbursement (DEBIT)
await prisma.partnerBalance.update({
  where: { partnerId_createdById: { partnerId: 1, createdById: userId } },
  data: {
    balance: { decrement: 9800 },    // balance = balance - 9800
    lastTransactionId: transaction.id,
    lastUpdated: new Date()
  }
});
// Result: { partnerId: 1, balance: 40200 }
// After repayment (CREDIT)
await prisma.partnerBalance.update({
  where: { partnerId_createdById: { partnerId: 1, createdById: userId } },
  data: {
    balance: { increment: 3300 },    // balance = balance + 3300
    lastTransactionId: transaction.id,
    lastUpdated: new Date()
  }
});
// Result: { partnerId: 1, balance: 43500 }
Benefits:

✅ O(1) lookup for current balance
✅ No need to calculate balance from transaction history
✅ Can add balance history tracking later (PartnerBalanceHistory table)
✅ Transactions remain immutable (can't change past data)
Balance History (Optional Enhancement):

model PartnerBalanceHistory {
  id              Int       @id @default(autoincrement())
  partnerId       Int
  balance         Float
  transactionId   Int
  timestamp       DateTime  @default(now())
  
  partner         Partner   @relation(fields: [partnerId], references: [id])
  transaction     Transaction @relation(fields: [transactionId], references: [id])
  
  @@index([partnerId, timestamp])
}
This allows queries like: "What was Partner A's balance on January 15, 2024?"

Component 3: Reusable Fee Structure System
[NEW] FeeStructure and FeeStructureMonth Models
Replace ChitFundFixedAmount with reusable templates:

// Template for a fee structure (e.g., "Standard 10-Month Plan")
model FeeStructure {
  id           Int       @id @default(autoincrement())
  name         String    // "Standard 10-Month Plan", "Premium 12-Month Plan"
  description  String?
  duration     Int       // Number of months
  createdById  Int
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  createdBy    User      @relation(fields: [createdById], references: [id])
  months       FeeStructureMonth[]
  chitFunds    ChitFund[]  // Many chit funds can use this structure
  
  @@index([createdById])
}
// Individual month amounts in a fee structure
model FeeStructureMonth {
  id              Int       @id @default(autoincrement())
  feeStructureId  Int
  month           Int       // Month number (1, 2, 3...)
  amount          Float     // Fixed amount for this month
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  feeStructure    FeeStructure @relation(fields: [feeStructureId], references: [id], onDelete: Cascade)
  
  @@unique([feeStructureId, month])
  @@index([feeStructureId])
}
Updated ChitFund Model:

model ChitFund {
  id                     Int       @id @default(autoincrement())
  name                   String
  totalAmount            Float
  monthlyContribution    Float
  firstMonthContribution Float?
  duration               Int
  membersCount           Int
  status                 String    @default("Active")
  startDate              DateTime
  currentMonth           Int       @default(1)
  nextAuctionDate        DateTime?
  description            String?
  chitFundType           String    @default("Auction")
+ feeStructureId         Int?      // ✅ Link to reusable fee structure
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
  createdById            Int
  
  createdBy              User      @relation(fields: [createdById], references: [id])
+ feeStructure           FeeStructure? @relation(fields: [feeStructureId], references: [id])
  
- // ❌ Remove old non-reusable model
- fixedAmounts           ChitFundFixedAmount[]
  
  auctions               Auction[]
  contributions          Contribution[]
  members                Member[]
  
+ @@index([feeStructureId])
  @@index([createdById])
}
- // ❌ Remove this model entirely
- model ChitFundFixedAmount {
-   id         Int      @id @default(autoincrement())
-   chitFundId Int
-   month      Int
-   amount     Float
-   chitFund   ChitFund @relation(fields: [chitFundId], references: [id])
-   @@unique([chitFundId, month])
- }
Example Usage:

// 1. Create a reusable fee structure once
const feeStructure = await prisma.feeStructure.create({
  data: {
    name: "Standard 10-Month Plan",
    description: "₹40K in month 1, ₹48K in months 2-10",
    duration: 10,
    createdById: userId,
    months: {
      create: [
        { month: 1, amount: 40000 },
        { month: 2, amount: 48000 },
        { month: 3, amount: 48000 },
        // ... up to month 10
      ]
    }
  }
});
// 2. Reuse the same structure for multiple chit funds
const chitFund1 = await prisma.chitFund.create({
  data: {
    name: "Chit Fund A",
    feeStructureId: feeStructure.id,  // ✅ Link to template
    // ... other fields
  }
});
const chitFund2 = await prisma.chitFund.create({
  data: {
    name: "Chit Fund B",
    feeStructureId: feeStructure.id,  // ✅ Same template reused
    // ... other fields
  }
});
// 3. Get fee structure for a chit fund
const chitFund = await prisma.chitFund.findUnique({
  where: { id: 1 },
  include: {
    feeStructure: {
      include: { months: true }
    }
  }
});
console.log(chitFund.feeStructure.months);
// [
//   { month: 1, amount: 40000 },
//   { month: 2, amount: 48000 },
//   ...
// ]
Benefits:

✅ Create fee structure once, use for many chit funds
✅ Update fee structure in one place, affects all linked chit funds
✅ Reduce data duplication (10 chit funds × 10 months = 100 rows → 10 rows)
✅ Easier to manage and audit fee structures
Component 4: Simplified Partner Tracking
Problems Solved:
Before (Confusing):

// Who disbursed this loan?
// - Check loan.disbursed_by_id
// - Check transaction.from_partner_id
// - Check transaction.action_performer (string)
// - Check transaction.entered_by (string)
After (Clear):

// Who disbursed this loan?
// - Check transaction.partner_id (one field)
Changes to Related Models:

model Loan {
  id                  Int       @id @default(autoincrement())
  // ... other fields ...
  
- disbursed_by_id     Int?      // ❌ Remove
- entered_by_id       Int?      // ❌ Remove
  transactionId       Int?      @unique
  
- disbursedBy         Partner?  @relation("DisbursedLoans")  // ❌ Remove
- enteredBy           Partner?  @relation("EnteredLoans")    // ❌ Remove
  transaction         Transaction? @relation(fields: [transactionId], references: [id])
}
model Repayment {
  id            Int      @id @default(autoincrement())
  // ... other fields ...
  
- collected_by_id Int?   // ❌ Remove
- entered_by_id   Int?   // ❌ Remove
  transactionId Int?     @unique
  
- collectedBy   Partner? @relation("CollectedRepayments")  // ❌ Remove
- enteredBy     Partner? @relation("EnteredRepayments")    // ❌ Remove
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
}
// Similar changes to Contribution and Auction models
Now just use:

// Get who disbursed a loan
const loan = await prisma.loan.findUnique({
  where: { id: loanId },
  include: {
    transaction: {
      include: { partner: true }  // ✅ Single source of truth
    }
  }
});
console.log(`Loan disbursed by: ${loan.transaction.partner.name}`);
Component 5: API Route Restructuring
Current Problem: Massive Consolidated Route Files
Current Structure:

app/api/
├── loans/
│   └── consolidated/
│       └── route.ts       ← 1,754 lines! 😱
├── chit-funds/
│   └── consolidated/
│       └── route.ts       ← 1,845 lines! 😱
└── transactions/
    └── route.ts           ← 1,090 lines
Current API Pattern (Using Query Parameters):

// Current messy approach - everything in one file
GET  /api/loans/consolidated?action=list
GET  /api/loans/consolidated?action=detail&id=123
GET  /api/loans/consolidated?action=repayments&id=123
GET  /api/loans/consolidated?action=payment-schedules&id=123
POST /api/loans/consolidated?action=create
POST /api/loans/consolidated?action=add-repayment&id=123
POST /api/loans/consolidated?action=update-overdue&id=123
PUT  /api/loans/consolidated?action=update&id=123
DELETE /api/loans/consolidated?action=delete&id=123
DELETE /api/loans/consolidated?action=delete-repayment&id=123
Problems:

❌ 1,700+ lines per file makes maintenance nightmare
❌ Action-based routing is not RESTful
❌ Hard to find specific operations
❌ Difficult to test individual endpoints
❌ Long switch statements for routing
❌ Cannot use Next.js App Router properly
❌ Poor code organization
Proposed Structure: RESTful Routing
New Structure:

app/api/
├── loans/
│   ├── route.ts                      → ~100 lines (list, create)
│   └── [id]/
│       ├── route.ts                  → ~80 lines (get, update, delete)
│       ├── repayments/
│       │   ├── route.ts              → ~120 lines (list repayments, add repayment)
│       │   └── [repaymentId]/
│       │       └── route.ts          → ~60 lines (delete repayment)
│       ├── payment-schedules/
│       │   └── route.ts              → ~150 lines (get payment schedules)
│       └── export/
│           └── route.ts              → ~50 lines (export loan)
├── chit-funds/
│   ├── route.ts                      → ~100 lines (list, create)
│   └── [id]/
│       ├── route.ts                  → ~100 lines (get, update, delete)
│       ├── members/
│       │   ├── route.ts              → ~120 lines (list, add member)
│       │   └── [memberId]/
│       │       └── route.ts          → ~80 lines (get, update, remove member)
│       ├── contributions/
│       │   ├── route.ts              → ~150 lines (list, add contribution)
│       │   └── [contributionId]/
│       │       └── route.ts          → ~60 lines (update, delete contribution)
│       ├── auctions/
│       │   ├── route.ts              → ~130 lines (list, add auction)
│       │   └── [auctionId]/
│       │       └── route.ts          → ~60 lines (update, delete auction)
│       └── export/
│           └── route.ts              → ~50 lines (export chit fund)
├── transactions/
│   ├── route.ts                      → ~150 lines (list, create)
│   ├── summary/
│   │   └── route.ts                  → (keep existing)
│   ├── aggregations/
│   │   └── route.ts                  → (keep existing)
│   └── export/
│       └── route.ts                  → (keep existing)
├── fee-structures/                   → NEW
│   ├── route.ts                      → ~80 lines (list, create)
│   └── [id]/
│       └── route.ts                  → ~60 lines (get, update, delete)
└── partners/
    ├── route.ts                      → ~80 lines (list, create)
    └── [id]/
        └── route.ts                  → ~60 lines (get, update, delete)
New RESTful API Endpoints:

Loans:

GET    /api/loans                         // List all loans
POST   /api/loans                         // Create new loan
GET    /api/loans/123                     // Get loan details
PUT    /api/loans/123                     // Update loan
DELETE /api/loans/123                     // Delete loan
GET    /api/loans/123/repayments          // List repayments
POST   /api/loans/123/repayments          // Add repayment
DELETE /api/loans/123/repayments/456      // Delete specific repayment
GET    /api/loans/123/payment-schedules   // Get payment schedules
GET    /api/loans/123/export              // Export single loan
Chit Funds:

GET    /api/chit-funds                    // List all chit funds
POST   /api/chit-funds                    // Create new chit fund
GET    /api/chit-funds/123                // Get chit fund details
PUT    /api/chit-funds/123                // Update chit fund
DELETE /api/chit-funds/123                // Delete chit fund
GET    /api/chit-funds/123/members        // List members
POST   /api/chit-funds/123/members        // Add member
GET    /api/chit-funds/123/members/456    // Get member detail
PUT    /api/chit-funds/123/members/456    // Update member
DELETE /api/chit-funds/123/members/456    // Remove member
GET    /api/chit-funds/123/contributions  // List contributions
POST   /api/chit-funds/123/contributions  // Add contribution
PUT    /api/chit-funds/123/contributions/789    // Update contribution
DELETE /api/chit-funds/123/contributions/789    // Delete contribution
GET    /api/chit-funds/123/auctions       // List auctions
POST   /api/chit-funds/123/auctions       // Add auction
PUT    /api/chit-funds/123/auctions/789   // Update auction
DELETE /api/chit-funds/123/auctions/789   // Delete auction
GET    /api/chit-funds/123/export         // Export chit fund
Fee Structures (NEW):

GET    /api/fee-structures                // List all fee structures
POST   /api/fee-structures                // Create new fee structure
GET    /api/fee-structures/123            // Get fee structure details
PUT    /api/fee-structures/123            // Update fee structure
DELETE /api/fee-structures/123            // Delete fee structure
Implementation Examples
Example 1: Loans List & Create

File: app/api/loans/route.ts (~100 lines)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
// GET /api/loans - List all loans
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status');
    const skip = (page - 1) * pageSize;
    const where = {
      createdById: currentUserId,
      ...(status && { status })
    };
    const [loans, totalCount] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: { borrower: true, _count: { select: { repayments: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.loan.count({ where })
    ]);
    return NextResponse.json({
      loans,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}
// POST /api/loans - Create new loan
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    // ... loan creation logic (move from consolidated file) ...
    
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 });
  }
}
Example 2: Single Loan Operations

File: app/api/loans/[id]/route.ts (~80 lines)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
// GET /api/loans/123 - Get loan details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loanId = parseInt(params.id);
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { borrower: true, _count: { select: { repayments: true } } }
    });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    if (loan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(loan);
  } catch (error) {
    console.error('Error fetching loan:', error);
    return NextResponse.json({ error: 'Failed to fetch loan' }, { status: 500 });
  }
}
// PUT /api/loans/123 - Update loan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ... update logic ...
}
// DELETE /api/loans/123 - Delete loan
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ... delete logic ...
}
Example 3: Loan Repayments

File: app/api/loans/[id]/repayments/route.ts (~120 lines)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth';
// GET /api/loans/123/repayments - List repayments
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUserId = await getCurrentUserId(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loanId = parseInt(params.id);
    
    // Verify loan belongs to user
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { createdById: true }
    });
    if (!loan || loan.createdById !== currentUserId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const skip = (page - 1) * pageSize;
    const [repayments, totalCount] = await Promise.all([
      prisma.repayment.findMany({
        where: { loanId },
        orderBy: [{ period: 'desc' }, { paidDate: 'desc' }],
        skip,
        take: pageSize
      }),
      prisma.repayment.count({ where: { loanId } })
    ]);
    return NextResponse.json({
      repayments,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    });
  } catch (error) {
    console.error('Error fetching repayments:', error);
    return NextResponse.json({ error: 'Failed to fetch repayments' }, { status: 500 });
  }
}
// POST /api/loans/123/repayments - Add repayment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ... repayment creation logic ...
}
Benefits of New Structure
Code Organization:

✅ Each file is 50-150 lines instead of 1,700+
✅ Easy to find specific operations
✅ Related operations grouped together
✅ Clear file hierarchy matches URL structure
Developer Experience:

✅ RESTful URLs are intuitive
✅ Easier to test individual endpoints
✅ Better IDE navigation
✅ Simpler code reviews (smaller diffs)
Performance:

✅ Smaller bundle per route (faster cold starts)
✅ Better code splitting
✅ No massive switch statements
Maintainability:

✅ Adding new operations is straightforward
✅ Less merge conflicts
✅ Easier onboarding for new developers
Migration Strategy for Routes
Phase 1: Create New Routes (Parallel)

Create new route structure alongside old consolidated routes
Implement new routes with simplified schema
Test new routes independently
Phase 2: Update Frontend (Incremental)

Update API client to use new endpoints
Migrate one feature at a time
Keep old endpoints working during migration
Phase 3: Remove Old Routes

Once all frontend migrated, remove old consolidated routes
Clean up unused code
Update documentation
Example Frontend Migration:

Before:

// Old API client
const response = await fetch(
  '/api/loans/consolidated?action=add-repayment&id=123',
  {
    method: 'POST',
    body: JSON.stringify(repaymentData)
  }
);
After:

// New API client (RESTful)
const response = await fetch(
  `/api/loans/123/repayments`,
  {
    method: 'POST',
    body: JSON.stringify(repaymentData)
  }
);
API Client Abstraction:

Create a centralized API client to make migration easier:

// lib/api-client.ts
class ApiClient {
  // Loans
  async listLoans(params?: { page?: number; pageSize?: number; status?: string }) {
    const query = new URLSearchParams(params as any);
    return fetch(`/api/loans?${query}`).then(r => r.json());
  }
  async getLoan(id: number) {
    return fetch(`/api/loans/${id}`).then(r => r.json());
  }
  async createLoan(data: LoanCreateInput) {
    return fetch('/api/loans', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(r => r.json());
  }
  async updateLoan(id: number, data: LoanUpdateInput) {
    return fetch(`/api/loans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }).then(r => r.json());
  }
  async deleteLoan(id: number) {
    return fetch(`/api/loans/${id}`, { method: 'DELETE' }).then(r => r.json());
  }
  // Repayments
  async listRepayments(loanId: number, params?: { page?: number; pageSize?: number }) {
    const query = new URLSearchParams(params as any);
    return fetch(`/api/loans/${loanId}/repayments?${query}`).then(r => r.json());
  }
  async addRepayment(loanId: number, data: RepaymentInput) {
    return fetch(`/api/loans/${loanId}/repayments`, {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(r => r.json());
  }
  async deleteRepayment(loanId: number, repaymentId: number) {
    return fetch(`/api/loans/${loanId}/repayments/${repaymentId}`, {
      method: 'DELETE'
    }).then(r => r.json());
  }
  // Chit Funds
  async listChitFunds(params?: { page?: number; pageSize?: number; status?: string }) {
    const query = new URLSearchParams(params as any);
    return fetch(`/api/chit-funds?${query}`).then(r => r.json());
  }
  // ... similar methods for chit funds, contributions, auctions, etc.
  // Fee Structures (NEW)
  async listFeeStructures() {
    return fetch('/api/fee-structures').then(r => r.json());
  }
  async createFeeStructure(data: FeeStructureInput) {
    return fetch('/api/fee-structures', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(r => r.json());
  }
}
export const api = new ApiClient();
Usage in Components:

// Before
const response = await fetch('/api/loans/consolidated?action=list&page=1');
// After
const response = await api.listLoans({ page: 1 });
This abstraction makes it easy to switch between old and new APIs during migration.

Data Migration Strategy
Step 1: Add New Fields (Non-Breaking)
-- Add new fields to Transaction table
ALTER TABLE "Transaction" 
  ADD COLUMN "transactionClass" TEXT,
  ADD COLUMN "partnerId" INTEGER;
-- Create new PartnerBalance table
CREATE TABLE "PartnerBalance" (
  id SERIAL PRIMARY KEY,
  "partnerId" INTEGER NOT NULL,
  balance FLOAT NOT NULL DEFAULT 0,
  "lastUpdated" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastTransactionId" INTEGER,
  "createdById" INTEGER NOT NULL,
  UNIQUE("partnerId", "createdById")
);
-- Create FeeStructure tables
CREATE TABLE "FeeStructure" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE "FeeStructureMonth" (
  id SERIAL PRIMARY KEY,
  "feeStructureId" INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount FLOAT NOT NULL,
  UNIQUE("feeStructureId", month)
);
Step 2: Migrate Existing Data
// Migration script (to be run once)
async function migrateTransactions() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'asc' }
  });
  
  for (const transaction of transactions) {
    // Determine transaction class
    let transactionClass: string;
    let partnerId: number | null = null;
    
    switch (transaction.type) {
      case 'LOAN_DISBURSEMENT':
      case 'AUCTION_PAYOUT':
        transactionClass = 'DEBIT';
        partnerId = transaction.from_partner_id;
        break;
      
      case 'LOAN_REPAYMENT':
      case 'CHIT_CONTRIBUTION':
      case 'DOCUMENT_CHARGE':
        transactionClass = 'CREDIT';
        partnerId = transaction.to_partner_id;
        break;
      
      case 'PARTNER_TO_PARTNER':
        transactionClass = 'TRANSFER';
        partnerId = transaction.from_partner_id || transaction.to_partner_id;
        break;
      
      case 'RECORD_AMOUNT':
        if (transaction.to_partner_id) {
          transactionClass = 'CREDIT';
          partnerId = transaction.to_partner_id;
        } else {
          transactionClass = 'DEBIT';
          partnerId = transaction.from_partner_id;
        }
        break;
      
      default:
        transactionClass = 'CREDIT';
        partnerId = transaction.to_partner_id || transaction.from_partner_id;
    }
    
    // Update transaction with new fields
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        transactionClass,
        partnerId
      }
    });
  }
  
  console.log(`Migrated ${transactions.length} transactions`);
}
async function initializePartnerBalances() {
  const partners = await prisma.partner.findMany();
  
  for (const partner of partners) {
    // Calculate final balance from all transactions
    const balance = await calculatePartnerBalanceFromTransactions(partner.id);
    
    // Create PartnerBalance record
    await prisma.partnerBalance.create({
      data: {
        partnerId: partner.id,
        balance,
        createdById: partner.createdById,
        lastUpdated: new Date()
      }
    });
  }
  
  console.log(`Initialized balances for ${partners.length} partners`);
}
async function migrateFeeStructures() {
  // Get all unique fee structures from ChitFundFixedAmount
  const chitFundsWithFixed = await prisma.chitFund.findMany({
    where: { chitFundType: 'Fixed' },
    include: { fixedAmounts: { orderBy: { month: 'asc' } } }
  });
  
  // Group chit funds with identical fee structures
  const feeStructureGroups = new Map<string, ChitFund[]>();
  
  for (const chitFund of chitFundsWithFixed) {
    const key = chitFund.fixedAmounts
      .map(fa => `${fa.month}:${fa.amount}`)
      .join(',');
    
    if (!feeStructureGroups.has(key)) {
      feeStructureGroups.set(key, []);
    }
    feeStructureGroups.get(key)!.push(chitFund);
  }
  
  // Create FeeStructure templates
  for (const [key, chitFunds] of feeStructureGroups) {
    const firstChitFund = chitFunds[0];
    
    const feeStructure = await prisma.feeStructure.create({
      data: {
        name: `Fee Structure ${key.substring(0, 20)}...`,
        description: `Migrated from ${chitFunds.length} chit funds`,
        duration: firstChitFund.duration,
        createdById: firstChitFund.createdById,
        months: {
          create: firstChitFund.fixedAmounts.map(fa => ({
            month: fa.month,
            amount: fa.amount
          }))
        }
      }
    });
    
    // Link all chit funds to this fee structure
    await prisma.chitFund.updateMany({
      where: { id: { in: chitFunds.map(cf => cf.id) } },
      data: { feeStructureId: feeStructure.id }
    });
  }
  
  console.log(`Created ${feeStructureGroups.size} fee structure templates`);
}
Step 3: Remove Old Fields (Breaking)
-- After verifying migration, remove old fields
ALTER TABLE "Transaction"
  DROP COLUMN "from_partner",
  DROP COLUMN "to_partner",
  DROP COLUMN "action_performer",
  DROP COLUMN "entered_by",
  DROP COLUMN "from_partner_id",
  DROP COLUMN "to_partner_id",
  DROP COLUMN "partnerBalance",
  DROP COLUMN "totalBalance";
-- Remove old ChitFundFixedAmount table
DROP TABLE "ChitFundFixedAmount";
-- Remove redundant fields from Loan, Repayment, Contribution, Auction
ALTER TABLE "Loan" DROP COLUMN "disbursed_by_id", DROP COLUMN "entered_by_id";
ALTER TABLE "Repayment" DROP COLUMN "collected_by_id", DROP COLUMN "entered_by_id";
ALTER TABLE "Contribution" DROP COLUMN "collected_by_id", DROP COLUMN "entered_by_id";
ALTER TABLE "Auction" DROP COLUMN "disbursed_by_id", DROP COLUMN "entered_by_id";
Code Changes Required
1. Update Transaction Creation
File: 
app/api/transactions/route.ts

Before:

const transaction = await prisma.transaction.create({
  data: {
    type,
    amount,
    date,
    note,
    from_partner_id: fromPartnerId,
    to_partner_id: toPartnerId,
    from_partner: fromPartner?.name,
    to_partner: toPartner?.name,
    action_performer: activePartner.name,
    entered_by: activePartner.name,
    partnerBalance: balanceCalculation.partnerBalance,
    totalBalance: balanceCalculation.totalBalance,
    createdById: currentUserId,
  }
});
After:

// Determine transaction class
const transactionClass = getTransactionClass(type, toPartnerId, fromPartnerId);
const partnerId = toPartnerId || fromPartnerId;
const transaction = await prisma.$transaction(async (tx) => {
  // Create transaction
  const txn = await tx.transaction.create({
    data: {
      type,
      amount,
      transactionClass,
      partnerId,
      date,
      note,
      createdById: currentUserId,
    }
  });
  
  // Update partner balance
  if (partnerId) {
    const balanceChange = transactionClass === 'CREDIT' ? amount : -amount;
    
    await tx.partnerBalance.upsert({
      where: {
        partnerId_createdById: { partnerId, createdById: currentUserId }
      },
      create: {
        partnerId,
        balance: balanceChange,
        createdById: currentUserId,
        lastTransactionId: txn.id
      },
      update: {
        balance: { increment: balanceChange },
        lastTransactionId: txn.id,
        lastUpdated: new Date()
      }
    });
  }
  
  return txn;
});
New Helper Function:

function getTransactionClass(
  type: string, 
  toPartnerId: number | null,
  fromPartnerId: number | null
): 'CREDIT' | 'DEBIT' | 'TRANSFER' {
  const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
  const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
  
  if (type === 'PARTNER_TO_PARTNER') return 'TRANSFER';
  if (creditTypes.includes(type)) return 'CREDIT';
  if (debitTypes.includes(type)) return 'DEBIT';
  
  // For RECORD_AMOUNT and others
  if (toPartnerId) return 'CREDIT';
  if (fromPartnerId) return 'DEBIT';
  
  return 'CREDIT'; // Default
}
2. Simplify Balance Queries
Before:

async function getCurrentPartnerBalance(partnerId: number, userId: number) {
  const lastTransaction = await prisma.transaction.findFirst({
    where: {
      createdById: userId,
      OR: [
        { from_partner_id: partnerId },
        { to_partner_id: partnerId }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return lastTransaction?.partnerBalance || 0;
}
After:

async function getCurrentPartnerBalance(partnerId: number, userId: number) {
  const partnerBalance = await prisma.partnerBalance.findUnique({
    where: {
      partnerId_createdById: { partnerId, createdById: userId }
    }
  });
  
  return partnerBalance?.balance || 0;
}
Much simpler! 🎉

3. Update Frontend Credit/Debit Display
Before:

function getCrDr(transaction: any): 'Credit' | 'Debit' {
  // 50 lines of logic to determine credit/debit
  if (transaction.type === 'PARTNER_TO_PARTNER') {
    if (transaction.from_partner && !transaction.to_partner) return 'Debit';
    // ... many more conditions
  }
  // ...
}
After:

function getCrDr(transaction: Transaction): string {
  return transaction.transactionClass; // 'CREDIT', 'DEBIT', or 'TRANSFER'
}
One line! 🎉

Verification Plan
Automated Tests
Unit Tests for Transaction Creation

# Create test file: tests/unit/transaction-creation.test.ts
npm run test tests/unit/transaction-creation.test.ts
Tests to write:

✅ LOAN_DISBURSEMENT creates DEBIT transaction
✅ LOAN_REPAYMENT creates CREDIT transaction
✅ PARTNER_TO_PARTNER creates TRANSFER transaction
✅ Partner balance updates correctly after transaction
Integration Tests for Balance Calculation

# Create test file: tests/integration/balance-tracking.test.ts
npm run test tests/integration/balance-tracking.test.ts
Tests to write:

✅ Partner balance starts at 0
✅ Loan disbursement reduces balance
✅ Loan repayment increases balance
✅ Multiple transactions calculate balance correctly
✅ Partner-to-partner transfer updates both balances
Migration Script Test

# Test migration on copy of production database
npm run test:migration
Verify:

✅ All transactions migrated with correct transactionClass
✅ Partner balances match calculated balances
✅ No data loss during migration
Manual Testing
Create New Loan

Navigate to Loans → Create New Loan
Fill in loan details with document charge
Submit
Verify:
✅ LOAN_DISBURSEMENT transaction created with class='DEBIT'
✅ DOCUMENT_CHARGE transaction created with class='CREDIT'
✅ Partner balance updated correctly
✅ Both transactions linked to loan record
Record Repayment

Navigate to loan detail page
Click "Record Repayment"
Enter repayment amount
Submit
Verify:
✅ LOAN_REPAYMENT transaction created with class='CREDIT'
✅ Partner balance increased
✅ Loan remaining amount decreased
Create Chit Fund with Fee Structure

Navigate to Fee Structures → Create New
Define amounts for each month
Save fee structure
Create new chit fund
Select the fee structure from dropdown
Verify:
✅ Fee structure appears in dropdown
✅ Chit fund linked to fee structure
✅ Can view fee structure details in chit fund page
Verify Partner Balance Page

Navigate to Partner Management
Check balance for each partner
Verify:
✅ Balances match transaction history
✅ Recent transactions show correct credit/debit
✅ Balance updates in real-time after new transaction
Transaction Export

Navigate to Transactions page
Click "Export to Excel"
Open exported file
Verify:
✅ Credit/Debit column shows correct values
✅ Partner column shows correct partner name
✅ All transaction types exported correctly
Database Verification Queries
-- Verify all transactions have transactionClass
SELECT COUNT(*) as missing_class 
FROM "Transaction" 
WHERE "transactionClass" IS NULL;
-- Expected: 0
-- Verify partner balances match calculated balances
SELECT 
  pb."partnerId",
  pb.balance as stored_balance,
  COALESCE(
    (SELECT SUM(CASE 
      WHEN t."transactionClass" = 'CREDIT' THEN t.amount
      WHEN t."transactionClass" = 'DEBIT' THEN -t.amount
      ELSE 0 
    END)
    FROM "Transaction" t
    WHERE t."partnerId" = pb."partnerId"
      AND t."createdById" = pb."createdById"),
    0
  ) as calculated_balance
FROM "PartnerBalance" pb;
-- stored_balance should equal calculated_balance for all rows
-- Verify fee structures are reused
SELECT 
  fs.id,
  fs.name,
  COUNT(cf.id) as chit_funds_using_this,
  COUNT(DISTINCT fsm.month) as months_defined
FROM "FeeStructure" fs
LEFT JOIN "ChitFund" cf ON cf."feeStructureId" = fs.id
LEFT JOIN "FeeStructureMonth" fsm ON fsm."feeStructureId" = fs.id
GROUP BY fs.id, fs.name
ORDER BY chit_funds_using_this DESC;
-- Should see multiple chit funds sharing same fee structures
Implementation Timeline
Phase 1: Schema Migration (2-3 hours)

Add new fields (non-breaking)
Run data migration scripts
Verify data integrity
Phase 2: API Updates (4-6 hours)

Update transaction creation logic
Update balance calculation logic
Update query methods
Phase 3: Frontend Updates (3-4 hours)

Update transaction display
Update balance display
Update forms for fee structures
Phase 4: Testing (2-3 hours)

Run automated tests
Perform manual testing
Verify database state
Phase 5: Cleanup (1-2 hours)

Remove old fields from schema
Remove old relations
Update documentation
Total Estimated Time: 12-18 hours

Rollback Plan
If issues are discovered after migration:

Before removing old fields: Simply stop using new fields, code can still use old fields
After removing old fields:
Restore database from backup
Or re-run reverse migration script to recreate old fields from new data
Summary of Benefits
Before vs After Comparison
Aspect	Before	After
Partner Tracking Fields	8 fields (4 strings + 2 IDs + 2 entries)	1 field (partnerId)
Credit/Debit Logic	50+ lines of code, duplicated	1 field (transactionClass)
Balance Query	Complex query with OR conditions	Simple lookup by primary key
Fee Structure Rows	10 chit funds × 10 months = 100 rows	1 template × 10 months = 10 rows
Transaction Creation	150+ lines	50 lines
Data Duplication	High (partner names, balances)	Low (normalized)
Query Performance	O(n) for balance	O(1) for balance
Maintainability	Difficult	Easy
Key Improvements
✅ Simplified Data Model: Reduced from 8 partner tracking fields to 1
✅ Explicit Credit/Debit: No more manual calculation, stored in database
✅ Efficient Balance Tracking: O(1) lookup instead of O(n) calculation
✅ Reusable Fee Structures: Create once, use for many chit funds
✅ Better Performance: Simpler queries, fewer JOIN operations
✅ Easier Maintenance: Single source of truth for all data
✅ Future-Proof: Can easily add features like balance history

This revamp addresses all the architectural issues while maintaining backward compatibility during migration. The new structure is cleaner, more efficient, and easier to maintain.

