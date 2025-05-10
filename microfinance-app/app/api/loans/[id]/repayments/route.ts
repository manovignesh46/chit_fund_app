import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust the import based on your project structure

export async function GET(req, { params }) {
    const { id } = params;

    try {
        const repayments = await prisma.repayment.findMany({
            where: { loanId: id },
        });
        return NextResponse.json(repayments);
    } catch (error) {
        return NextResponse.error();
    }
}

export async function POST(req, { params }) {
    const { id } = params;
    const { amount, paidDate } = await req.json();

    try {
        const repayment = await prisma.repayment.create({
            data: {
                loanId: id,
                amount,
                paidDate,
            },
        });
        return NextResponse.json(repayment, { status: 201 });
    } catch (error) {
        return NextResponse.error();
    }
}