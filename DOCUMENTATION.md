# Microfinance and Chit Fund Management Application

## Overview

This application is a full-stack solution for managing microfinance operations and chit funds. It provides comprehensive tools for tracking loans, chit funds, members, and financial metrics through an intuitive dashboard.

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Installation & Setup](#installation--setup)
3. [Project Structure](#project-structure)
4. [Key Features](#key-features)
5. [Authentication & Security](#authentication--security)
6. [Dashboard](#dashboard)
7. [Member Management](#member-management)
8. [Chit Fund Management](#chit-fund-management)
9. [Loan Management](#loan-management)
10. [Financial Calculations](#financial-calculations)
11. [Performance Optimizations](#performance-optimizations)
12. [Deployment](#deployment)
13. [API Structure](#api-structure)
14. [Database Schema](#database-schema)
15. [UI/UX Features](#uiux-features)
16. [Implementation Details](#implementation-details)
17. [Maintenance and Troubleshooting](#maintenance-and-troubleshooting)

## Technology Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MySQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Data Fetching**: SWR for client-side data fetching
- **Charts & Visualization**: Recharts
- **Export Functionality**: ExcelJS, XLSX

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MySQL database
- Git

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/microfinance-app.git
   cd microfinance-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy the `.env.example` file to `.env`
   ```bash
   cp .env.example .env
   ```
   - Update the `.env` file with your database connection string and other configuration
   ```
   DATABASE_URL="mysql://username:password@host:port/database"
   JWT_SECRET="your-secret-key-for-jwt-encryption"
   ADMIN_EMAIL="amfincorp1@gmail.com"
   ADMIN_PASSWORD="AMFadmin2020"
   ```

4. **Set up the database**
   - Run Prisma migrations to create the database schema
   ```bash
   npx prisma migrate dev
   ```
   - Seed the database with initial data (optional)
   ```bash
   npm run seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   - The application will be available at http://localhost:3000

6. **Login with default admin credentials**
   - Email: amfincorp1@gmail.com
   - Password: AMFadmin2020
   - It's recommended to change these credentials after first login

### Database Configuration

The application uses MySQL as the database. The connection string in the `.env` file should be in the following format:

```
DATABASE_URL="mysql://username:password@host:port/database"
```

For example, for a local MySQL instance:
```
DATABASE_URL="mysql://root:password@localhost:3306/microfinance"
```

For the Railway-hosted database:
```
DATABASE_URL="mysql://username:password@yamanote.proxy.rlwy.net:17751/microfinance"
```

## Project Structure

```
microfinance-app
├── app                   # Next.js App Router structure
│   ├── api               # API routes
│   ├── chit-funds        # Chit fund pages
│   ├── loans             # Loan management pages
│   ├── members           # Member management pages
│   ├── dashboard         # Dashboard page
│   └── components        # Shared components
├── lib                   # Utility functions and shared logic
│   ├── api.ts            # API client functions
│   ├── auth.ts           # Authentication utilities
│   ├── financialUtils.ts # Financial calculation utilities
│   ├── formatUtils.ts    # Data formatting utilities
│   ├── paymentSchedule.ts # Payment schedule generation
│   └── prisma.ts         # Prisma client instance
├── prisma                # Prisma ORM configuration
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seeding script
├── public                # Static assets
├── scripts               # Utility scripts for deployment and optimization
├── styles                # Global styles
└── middleware.ts         # Next.js middleware for authentication
```

## Key Features

### Dashboard
- Summary of financial metrics (cash inflow, outflow, profit)
- Separate profit tracking for loans and chit funds
- Outside amount tracking for chit funds
- Recent activities and upcoming events
- Financial charts with selectable time periods

### Member Management
- Global member system for cross-program tracking
- Detailed member information with financial status
- Export functionality for member data
- Pagination with selectable options

### Chit Fund Management
- Create and manage chit funds with flexible parameters
- Track monthly contributions and auctions
- Assign members to chit funds
- Calculate profit based on contributions and auctions
- View by month or by member

### Loan Management
- Support for monthly and weekly loans
- Payment scheduling and tracking
- Interest-only payment option for monthly loans
- Document charge tracking
- Overdue status management
- Export functionality

## Authentication & Security

The application uses JWT-based authentication with the following security features:

- HTTP-only cookies for token storage
- Role-based access control (admin access only)
- Data ownership validation for all operations
- Middleware protection for all non-public routes
- Environment variable configuration for sensitive data

Default admin credentials are stored in environment variables:
- Email: `ADMIN_EMAIL` (default: amfincorp1@gmail.com)
- Password: `ADMIN_PASSWORD` (default: AMFadmin2020)

## Dashboard

The dashboard provides a comprehensive overview of the financial status:

- **Remaining Loan Balances**: Total pending loan repayments expected to be collected
- **Chit Fund Outside Amount**: Amount still pending or over-disbursed from chit fund operations
- **Profit**: Separate tracking for loan profit and chit fund profit with hidden values by default
- **Financial Charts**: Visualizations for cash flow, profit, and outside amount with selectable time periods (weekly, monthly, yearly)
- **Recent Activities**: Latest member additions, auctions, loans, and repayments with detailed information and clickable links
- **Upcoming Events**: Payment schedules and auction dates with due amounts and status indicators

### Dashboard Cards
The dashboard displays actionable financial metrics through the following cards:

1. **Remaining Loan Balances**: Shows the total amount of pending loan repayments that are expected to be collected, providing a clear view of outstanding receivables.

2. **Chit Fund Outside Amount**: Displays the amount that is still pending or over-disbursed from chit fund operations, helping track financial exposure.

3. **Total Profit**: Shows the combined profit from all operations, with a toggle option to hide/show the value for privacy.

4. **Profit Breakdown** (visible when Total Profit is toggled on):
   - **Loan Profit**: Profit from loan interest and document charges
   - **Chit Fund Profit**: Profit from auction commissions

## Member Management

The application uses a global member system that allows tracking members across different chit funds and loans:

- **Global Members**: Central repository of all members
- **Member Assignment**: Assign existing members to chit funds or loans
- **Financial Status**: Track overdue amounts, missed contributions, and pending amounts
- **Export Options**: Export individual member data or selected/all members

## Chit Fund Management

Chit funds are managed with the following features:

- **Creation**: Set up chit funds with name, amount, duration, and member count
- **Contributions**: Track monthly contributions with support for partial payments
- **Auctions**: Record monthly auctions with winner and amount
- **Profit Calculation**: Calculate profit as the difference between cash inflow and outflow
- **Member View**: View contributions by member
- **Month View**: View all members' contributions for a specific month

## Loan Management

The application supports two types of loans:

### Monthly Loans
- Interest accrues monthly
- Installment = Principal/Duration + Interest
- Support for interest-only payments
- Document charge can be added

### Weekly Loans
- Duration in weeks
- No interest fields
- Installment = Principal/(Duration-1)
- Profit comes from document charge

### Common Features
- Payment scheduling based on disbursement date
- Overdue status tracking (pending for 3 days after due date)
- Export functionality for loan details and repayment history

## Financial Calculations

The application uses centralized utility functions for consistent financial calculations:

### Loan Profit Calculation
- Monthly loans: Interest amount × number of dues paid + document charge
- Weekly loans: Document charge + any excess payments

### Chit Fund Profit Calculation
- Difference between total cash inflow (contributions) and cash outflow (auctions)
- Auction profit: Monthly total contribution - auction amount

### Outside Amount Calculation
- Tracks when cash outflow exceeds inflow in chit funds

## Performance Optimizations

The application includes several performance optimizations:

- **API Route Consolidation**: Consolidated API routes to stay within Vercel's limits
- **Incremental Static Regeneration (ISR)**: 5-minute revalidation period for cached data
- **Parallel Database Queries**: Using Promise.all for faster response times
- **Optimized Database Schema**: Efficient relationships and indexes
- **Client-Side Caching**: SWR for efficient data fetching with built-in caching
- **Bundle Size Optimization**: Dynamic imports and code splitting

## Deployment

The application is optimized for deployment on Vercel with the following considerations:

- **Prisma Configuration**: Binary targets include Vercel's environment targets
- **Size Limitations**: Optimized for Vercel's 250MB unzipped size limit
- **API Route Consolidation**: Consolidated to stay within the limit of serverless functions
- **Environment Variables**: Configuration via Vercel environment variables

## API Structure

The API is organized into consolidated routes for efficiency:

- `/api/dashboard/consolidated`: Dashboard data and financial metrics
- `/api/chit-funds/consolidated`: Chit fund management
- `/api/loans/consolidated`: Loan management
- `/api/members/consolidated`: Member management
- `/api/user`: Authentication and user management

Each consolidated route handles multiple actions via query parameters to reduce the number of serverless functions.

### API Endpoints

#### Authentication Endpoints
- `POST /api/user?action=login`: Authenticate user and generate JWT token
- `POST /api/user?action=logout`: Invalidate user session
- `POST /api/user?action=register`: Register a new user (admin only)
- `GET /api/user?action=me`: Get current user information

#### Dashboard Endpoints
- `GET /api/dashboard/consolidated?action=summary`: Get financial summary data
- `GET /api/dashboard/consolidated?action=activities`: Get recent activities
- `GET /api/dashboard/consolidated?action=events`: Get upcoming events for dashboard
- `GET /api/dashboard/consolidated?action=events&view=calendar&year={year}&month={month}`: Get events for calendar view with status and due amounts
- `GET /api/dashboard/consolidated?action=financial-data`: Get financial data for charts
- `GET /api/dashboard/consolidated?action=export`: Export financial data

#### Chit Fund Endpoints
- `GET /api/chit-funds/consolidated?action=list`: Get list of chit funds
- `GET /api/chit-funds/consolidated?action=detail&id={id}`: Get chit fund details
- `POST /api/chit-funds/consolidated?action=create`: Create a new chit fund
- `PUT /api/chit-funds/consolidated?action=update&id={id}`: Update a chit fund
- `DELETE /api/chit-funds/consolidated?action=delete&id={id}`: Delete a chit fund
- `POST /api/chit-funds/consolidated?action=add-member&id={id}`: Add member to chit fund
- `POST /api/chit-funds/consolidated?action=add-contribution&id={id}`: Add contribution
- `POST /api/chit-funds/consolidated?action=add-auction&id={id}`: Add auction

#### Loan Endpoints
- `GET /api/loans/consolidated?action=list`: Get list of loans
- `GET /api/loans/consolidated?action=detail&id={id}`: Get loan details
- `POST /api/loans/consolidated?action=create`: Create a new loan
- `PUT /api/loans/consolidated?action=update&id={id}`: Update a loan
- `DELETE /api/loans/consolidated?action=delete&id={id}`: Delete a loan
- `POST /api/loans/consolidated?action=add-repayment&id={id}`: Add repayment
- `GET /api/loans/consolidated?action=payment-schedules&id={id}`: Get payment schedules
- `GET /api/loans/consolidated?action=export&id={id}`: Export loan data

#### Member Endpoints
- `GET /api/members/consolidated?action=list`: Get list of members
- `GET /api/members/consolidated?action=detail&id={id}`: Get member details
- `POST /api/members/consolidated?action=create`: Create a new member
- `PUT /api/members/consolidated?action=update&id={id}`: Update a member
- `DELETE /api/members/consolidated?action=delete&id={id}`: Delete a member
- `GET /api/members/consolidated?action=export&id={id}`: Export member data

## Database Schema

The database schema includes the following main entities:

- **User**: Authentication and data ownership
- **ChitFund**: Chit fund details and configuration
- **GlobalMember**: Central member repository
- **Member**: Chit fund-specific member information
- **Contribution**: Monthly chit fund contributions
- **Auction**: Monthly chit fund auctions
- **Loan**: Loan details and configuration
- **Repayment**: Loan repayment records
- **PaymentSchedule**: Scheduled loan payments

All entities include data ownership fields to ensure data is only visible to the user who created it.

## UI/UX Features

### General UI Principles
- Consistent positioning of UI elements across the application
- Skeleton loading states for better loading experience
- Clickable table rows for viewing details instead of separate view buttons
- Consistent button colors and positioning

### Calendar and Upcoming Events
- **Calendar View**: Monthly calendar showing all events (loan payments and chit fund auctions)
- **Event Status Indicators**:
  - **Paid**: Past events that have been paid are highlighted with green background and "Paid" badge
  - **Overdue**: Past events that haven't been paid are highlighted with red background and "Overdue" badge
  - **Due Tomorrow**: Events due tomorrow are highlighted with yellow background (#fff3cd) and "Due Tomorrow" badge
- **Due Amount Display**: Each event shows the payment amount due
- **Filtering**: Events can be filtered by type (All, Loan, Chit Fund)
- **Navigation**: Month-to-month navigation with current month indicator
- **Event Details**: Clicking an event navigates to the relevant loan or chit fund detail page

### Dashboard UI
- Financial metrics displayed prominently at the top with actionable insights
- Only 3 upcoming events shown by default, with "View Calendar" option for more
- Each upcoming event displays the due amount and status (Paid, Overdue, or Due Tomorrow)
- Recent activities section shows the latest transactions and actions with:
  - Activity type indicator (Loan or Chit Fund)
  - Date and time of the activity
  - Detailed description of the action
  - Amount involved (if applicable)
  - Clickable links to the relevant entity page
- Graphs for cash inflow/outflow, profit, and outside amount with selectable time periods (weekly, monthly, yearly)
- Export functionality for financial data based on selected time period

### Member Management UI
- Paginated member list with selectable page sizes (5, 10, 20, 50, 100)
- Export buttons for individual members and bulk export options
- Detailed member information page showing all financial relationships

### Chit Fund UI
- Month View as default for contributions page
- Clickable rows to display Member View for specific months
- Profit amounts hidden by default, displayed only when tapped/clicked
- Edit and export buttons consistently positioned

### Loan UI
- Toggle buttons for interest-only payments
- Automatic calculation of date fields
- Upcoming payments due tomorrow highlighted with yellow background (#fff3cd)
- "Due Tomorrow" badge for urgent payments

## Implementation Details

### Authentication Flow
1. User navigates to login page
2. Credentials are validated against database
3. JWT token is generated and stored in HTTP-only cookie
4. Middleware validates token for protected routes
5. Data ownership is verified for all operations

### Financial Calculation Implementation
- Centralized utility functions in `lib/financialUtils.ts`
- Consistent profit calculation methods across the application
- Reusable functions for both individual entities and dashboard calculations

### Payment Schedule Generation
- Dynamic generation based on loan disbursement date and repayment type
- Automatic status updates (Pending, Paid, Missed, Overdue)
- Support for interest-only payments in monthly loans

### Data Export Implementation
- Excel file generation using ExcelJS
- Comprehensive data export including financial metrics
- Support for individual and bulk exports

## Maintenance and Troubleshooting

### Common Issues
- Database connection errors: Check connection string in environment variables
- Authentication failures: Verify JWT_SECRET is properly set
- Performance issues: Run optimization scripts in the scripts directory

### Regular Maintenance Tasks
- Run database optimization scripts periodically
- Monitor API performance and optimize as needed
- Update dependencies to latest compatible versions

### Extending the Application
- Add new API handlers to the consolidated route files
- Follow the established patterns for data ownership and validation
- Use the centralized utility functions for financial calculations
