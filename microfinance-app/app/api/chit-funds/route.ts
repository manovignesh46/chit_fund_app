import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { templateService } from "@/app/lib/templateService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { templateId, ...chitFundData } = data;

    // Start a transaction
    const chitFund = await prisma.$transaction(async (tx) => {
      // Create the chit fund
      const newChitFund = await tx.chitFund.create({
        data: {
          ...chitFundData,
          createdById: session.user.id,
        },
      });

      // If it's a fixed type and has a template, clone the template amounts
      if (chitFundData.chitFundType === "Fixed" && templateId) {
        await templateService.cloneTemplateToChitFund(templateId, newChitFund.id);
      }

      return newChitFund;
    });

    return NextResponse.json(chitFund);
  } catch (error) {
    console.error("Error creating chit fund:", error);
    return NextResponse.json(
      { error: "Failed to create chit fund" },
      { status: 500 }
    );
  }
}
