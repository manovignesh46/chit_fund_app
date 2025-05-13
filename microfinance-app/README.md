# Microfinance and Chit Fund Management Application

This project is a full-stack microfinance and chit fund management application built using Next.js, Tailwind CSS, Prisma ORM, and PostgreSQL. It provides features for managing chit funds and loans, along with a dashboard for tracking financial metrics.

## Features

### Chit Fund Management
- Create chit funds with:
  - Name
  - Amount
  - Members count
  - Duration (months)
- Assign members to chit funds
- Track each member’s monthly contribution
- Automatically assign one member per month as payout receiver with decreasing profit margin
- Calculate:
  - Monthly profit
  - Total amount collected
  - Receiver's final payout

### Loan Management
- Add borrowers with:
  - Name
  - Contact
  - Loan amount
  - Repayment type (weekly/monthly)
- For weekly loans:
  - Repayment over N weeks
  - Auto-calculate weekly payment
- For monthly loans:
  - Repayment over N months
  - Auto-calculate monthly payment
- Track repayments:
  - Paid date
  - Amount
- Show:
  - Remaining balance
  - Total interest/profit

### Dashboard
- View pages for:
  - Chit fund summary
  - Member list
  - Loan repayment history
- Summary cards for:
  - Total cash inflow
  - Outflow
  - Profit

## Technologies Used
- **Next.js**: Framework for building server-rendered React applications.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Prisma ORM**: Database toolkit for TypeScript and Node.js.
- **MySQL**: Relational database for storing application data.
- **JWT**: JSON Web Tokens for authentication.
- **SWR**: React Hooks for data fetching.

## Project Structure
```
microfinance-app
├── app
│   ├── api
│   ├── chit-funds
│   ├── loans
│   ├── dashboard
│   └── layout.tsx
├── prisma
│   └── schema.prisma
├── public
├── styles
│   └── globals.css
├── .env
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Setup and Deployment
1. Clone the repository.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the `.env.example` file to `.env` and update it with your configuration:
   ```
   cp .env.example .env
   ```
4. Set up your MySQL database and update the `.env` file with your connection string.
5. Make sure to set a strong JWT_SECRET in the `.env` file for authentication.
6. Run the Prisma migrations:
   ```
   npx prisma migrate dev
   ```
7. Start the development server:
   ```
   npm run dev
   ```
8. Deploy to Vercel:
   - Push your code to GitHub
   - Connect your repository to Vercel
   - Add the following environment variables in Vercel:
     - `DATABASE_URL`: Your MySQL database connection string
     - `JWT_SECRET`: A strong secret key for JWT authentication
     - `ADMIN_EMAIL`: Admin login email
     - `ADMIN_PASSWORD`: Admin login password

## License
This project is licensed under the MIT License.