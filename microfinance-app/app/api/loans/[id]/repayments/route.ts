import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust the import based on your project structure

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const repayments = await prisma.repayment.findMany({
            where: { loanId: Number(id) },
        });
        return NextResponse.json(repayments);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch repayments' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { amount, paidDate } = await request.json();

        const repayment = await prisma.repayment.create({
            data: {
                loanId: Number(id),
                amount: parseFloat(amount),
                paidDate: new Date(paidDate),
            },
        });
        return NextResponse.json(repayment, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create repayment' },
            { status: 500 }
        );
    }
}