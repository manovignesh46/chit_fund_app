// pages/api/debug-loan-api.js
// A simple API endpoint to check the raw loan data from Prisma

import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") ? parseInt(searchParams.get("id")!) : null;
    
    if (!id) {
      return NextResponse.json({ error: "Loan ID is required" }, { status: 400 });
    }
    
    // Get the loan directly from Prisma
    const loan = await prisma.loan.findUnique({
      where: { id },
    });
    
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }
    
    // Log the loan data to the server console
    console.log('Debug API - Raw loan data:', loan);
    
    // Return the loan data as JSON
    return NextResponse.json({
      rawLoanData: loan,
      hasRemainingDue: 'remainingDue' in loan,
      remainingDueType: typeof loan.remainingDue,
      remainingDueValue: loan.remainingDue,
    });
    
  } catch (error) {
    console.error("Error in debug API:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
