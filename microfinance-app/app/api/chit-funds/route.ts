import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserId, isResourceOwner } from '@/lib/auth';
import { apiCache } from '@/lib/cache';


// Use ISR with a 5-minute revalidation period
export const revalidate = 300; // 5 minutes
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const status = searchParams.get('status') || null;

        // Validate pagination parameters
        const validPage = page > 0 ? page : 1;
        const validPageSize = pageSize > 0 ? pageSize : 10;

        // Calculate skip value for pagination
        const skip = (validPage - 1) * validPageSize;

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Build where clause for filtering
        const where: any = {
            // Only show chit funds created by the current user
            createdById: currentUserId
        };

        if (status) {
            where.status = status;
        }

        // Get total count for pagination with filter
        const totalCount = await prisma.chitFund.count({
            where
        });

        // Get paginated chit funds with filter
        const chitFunds = await prisma.chitFund.findMany({
            where,
            include: {
                _count: {
                    select: { members: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: validPageSize,
        });

        return NextResponse.json({
            chitFunds,
            totalCount,
            page: validPage,
            pageSize: validPageSize,
            totalPages: Math.ceil(totalCount / validPageSize)
        });
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

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
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
                // Set the creator
                createdById: currentUserId,
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

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if the chit fund exists and belongs to the current user
        const existingChitFund = await prisma.chitFund.findUnique({
            where: { id: body.id },
            select: { createdById: true }
        });

        if (!existingChitFund) {
            return NextResponse.json(
                { error: 'Chit fund not found' },
                { status: 404 }
            );
        }

        // Check if the current user is the owner
        if (existingChitFund.createdById !== currentUserId) {
            return NextResponse.json(
                { error: 'You do not have permission to update this chit fund' },
                { status: 403 }
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

        // Get the current user ID
        const currentUserId = getCurrentUserId(request);
        if (!currentUserId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Check if the chit fund exists and belongs to the current user
        const existingChitFund = await prisma.chitFund.findUnique({
            where: { id },
            select: { createdById: true }
        });

        if (!existingChitFund) {
            return NextResponse.json(
                { error: 'Chit fund not found' },
                { status: 404 }
            );
        }

        // Check if the current user is the owner
        if (existingChitFund.createdById !== currentUserId) {
            return NextResponse.json(
                { error: 'You do not have permission to delete this chit fund' },
                { status: 403 }
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