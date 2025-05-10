import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust the import based on your project structure

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const loan = await prisma.loan.findUnique({
            where: { id: Number(id) },
        });

        if (!loan) {
            return NextResponse.json({ message: 'Loan not found' }, { status: 404 });
        }

        return NextResponse.json(loan);
    } catch (error) {
        return NextResponse.json({ message: 'Error retrieving loan' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await request.json();

        const updatedLoan = await prisma.loan.update({
            where: { id: Number(id) },
            data,
        });

        return NextResponse.json(updatedLoan);
    } catch (error) {
        return NextResponse.json({ message: 'Error updating loan' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.loan.delete({
            where: { id: Number(id) },
        });

        return NextResponse.json({ message: 'Loan deleted successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Error deleting loan' }, { status: 500 });
    }
}