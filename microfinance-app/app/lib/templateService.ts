import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";

export type FixedAmountTemplateWithRows = Prisma.FixedAmountTemplateGetPayload<{
  include: {
    amounts: true;
  };
}>;

export type CreateTemplateInput = {
  name: string;
  description?: string;
  totalAmount: number;
  duration: number;
  amounts: { month: number; amount: number }[];
  userId: number;
};

export const templateService = {
  async createTemplate(data: CreateTemplateInput) {
    return prisma.fixedAmountTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        totalAmount: data.totalAmount,
        duration: data.duration,
        createdById: data.userId,
        amounts: {
          create: data.amounts,
        },
      },
      include: {
        amounts: true,
      },
    });
  },

  async updateTemplate(
    id: number,
    data: Omit<CreateTemplateInput, "userId">
  ) {
    // First delete existing amounts
    await prisma.fixedAmountTemplateRow.deleteMany({
      where: { templateId: id },
    });

    // Then update template and create new amounts
    return prisma.fixedAmountTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        totalAmount: data.totalAmount,
        duration: data.duration,
        amounts: {
          create: data.amounts,
        },
      },
      include: {
        amounts: true,
      },
    });
  },

  async getTemplate(id: number) {
    return prisma.fixedAmountTemplate.findUnique({
      where: { id },
      include: {
        amounts: {
          orderBy: { month: "asc" },
        },
      },
    });
  },

  async getTemplates(userId: number) {
    return prisma.fixedAmountTemplate.findMany({
      where: { 
        createdById: userId,
        isActive: true 
      },
      include: {
        amounts: {
          orderBy: { month: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  async deleteTemplate(id: number) {
    return prisma.fixedAmountTemplate.delete({
      where: { id },
    });
  },

  async cloneTemplateToChitFund(templateId: number, chitFundId: number) {
    const template = await prisma.fixedAmountTemplate.findUnique({
      where: { id: templateId },
      include: { amounts: true },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    // Create fixed amounts for the chit fund
    return prisma.chitFundFixedAmount.createMany({
      data: template.amounts.map((row) => ({
        chitFundId,
        month: row.month,
        amount: row.amount,
      })),
    });
  },
};
