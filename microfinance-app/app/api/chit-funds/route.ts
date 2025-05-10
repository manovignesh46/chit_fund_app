import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const chitFunds = await prisma.chitFund.findMany({
            include: {
                _count: {
                    select: { members: true }
                }
            }
        });
        return NextResponse.json(chitFunds);
    } catch (error) {
        console.error('Error fetching chit funds:', error);
        return NextResponse.json(
            { error: 'Failed to fetch chit funds' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const requiredFields = ['name', 'totalAmount', 'monthlyContribution', 'duration', 'membersCount', 'startDate'];
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { error: `${field} is required` },
                    { status: 400 }
                );
            }
        }

        // Create the chit fund
        const chitFund = await prisma.chitFund.create({
            data: {
                name: body.name,
                totalAmount: parseFloat(body.totalAmount),
                monthlyContribution: parseFloat(body.monthlyContribution),
                duration: parseInt(body.duration),
                membersCount: parseInt(body.membersCount),
                status: body.status || 'Active',
                startDate: new Date(body.startDate),
                nextAuctionDate: body.nextAuctionDate ? new Date(body.nextAuctionDate) : null,
                description: body.description || null,
            }
        });

        return NextResponse.json(chitFund, { status: 201 });
    } catch (error) {
        console.error('Error creating chit fund:', error);
        return NextResponse.json(
            { error: 'Failed to create chit fund' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { error: 'ID is required' },
                { status: 400 }
            );
        }

        const chitFund = await prisma.chitFund.update({
            where: { id: body.id },
            data: {
                name: body.name,
                totalAmount: body.totalAmount ? parseFloat(body.totalAmount) : undefined,
                monthlyContribution: body.monthlyContribution ? parseFloat(body.monthlyContribution) : undefined,
                duration: body.duration ? parseInt(body.duration) : undefined,
                membersCount: body.membersCount ? parseInt(body.membersCount) : undefined,
                status: body.status,
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                nextAuctionDate: body.nextAuctionDate ? new Date(body.nextAuctionDate) : null,
                description: body.description,
                currentMonth: body.currentMonth ? parseInt(body.currentMonth) : undefined,
            },
        });

        return NextResponse.json(chitFund);
    } catch (error) {
        console.error('Error updating chit fund:', error);
        return NextResponse.json(
            { error: 'Failed to update chit fund' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: 'ID is required' },
                { status: 400 }
            );
        }

        // Delete related records first
        await prisma.contribution.deleteMany({
            where: { chitFundId: id },
        });

        await prisma.auction.deleteMany({
            where: { chitFundId: id },
        });

        await prisma.member.deleteMany({
            where: { chitFundId: id },
        });

        // Delete the chit fund
        await prisma.chitFund.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Chit fund deleted successfully' });
    } catch (error) {
        console.error('Error deleting chit fund:', error);
        return NextResponse.json(
            { error: 'Failed to delete chit fund' },
            { status: 500 }
        );
    }
}