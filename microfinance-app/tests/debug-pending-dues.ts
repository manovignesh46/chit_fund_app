// Debug script for pending dues logic
// Run with: npx ts-node tests/debug-pending-dues.ts

import { getFinancialDataForExport } from '../lib/commonExportUtils';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('🔍 Running getFinancialDataForExport directly...');
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' }
    });

    if (!adminUser) {
        console.error('❌ No admin user found');
        return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30); // Last 30 days

    console.log(`User ID: ${adminUser.id}`);
    console.log(`Period: ${startDate.toISOString()} - ${endDate.toISOString()}`);

    const result = await getFinancialDataForExport(adminUser.id, startDate, endDate, 'single');
    
    console.log('✅ getFinancialDataForExport Success!');
    console.log('Pending Dues Found:', result.pendingDues?.length || 0);
    if(result.pendingDues?.length > 0) {
        console.log('First 2 Pending Dues:', JSON.stringify(result.pendingDues.slice(0, 2), null, 2));
    }

    // Generate Excel
    const { generateCommonExcelReport } = require('../lib/commonExportUtils');
    const fs = require('fs');
    const path = require('path');
    
    console.log('Generating Excel report...');
    const buffer = await generateCommonExcelReport(result, startDate, endDate, 'Debug Report', 'Custom Period');
    
    const outputPath = path.join(__dirname, '../temp/debug_pending_dues.xlsx');
    // Ensure temp dir exists
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath));
    }
    
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Excel report generated at: ${outputPath}`);


  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
