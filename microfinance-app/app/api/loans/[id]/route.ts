import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Adjust the import based on your project structure

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    const data = await request.json();

    try {
        const updatedLoan = await prisma.loan.update({
            where: { id: Number(id) },
            data,
        });

        return NextResponse.json(updatedLoan);
    } catch (error) {
        return NextResponse.json({ message: 'Error updating loan' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const { id } = params;

    try {
        await prisma.loan.delete({
            where: { id: Number(id) },
        });

        return NextResponse.json({ message: 'Loan deleted successfully' });
    } catch (error) {
        return NextResponse.json({ message: 'Error deleting loan' }, { status: 500 });
    }
}