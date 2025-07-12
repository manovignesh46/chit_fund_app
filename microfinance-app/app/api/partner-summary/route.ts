import { NextRequest, NextResponse } from 'next/server';
import { 
  calculatePartnerMonthlySummary, 
  getAllPartnersMonthlySummary, 
  getPartnerMonthlySummary 
} from '../../../lib/partnerSummaryService';
import { getCurrentMonth, extractMonthYear, formatMonthYear } from '../../../lib/partnerSummaryUtils';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const partnerId = url.searchParams.get('partnerId');
    const monthParam = url.searchParams.get('month');
    const yearParam = url.searchParams.get('year');
    
    let month: string;
    
    // Handle both new way (separate month/year) and old way (combined string)
    if (monthParam && yearParam) {
      // New way: separate month and year parameters
      month = formatMonthYear(parseInt(monthParam), parseInt(yearParam));
    } else {
      // Old way: use month string or default to current month
      month = monthParam || getCurrentMonth();
    }

    // Get all partners' summaries if no partnerId is provided
    if (!partnerId) {
      const summaries = await getAllPartnersMonthlySummary(month);
      return NextResponse.json({ success: true, data: summaries });
    }

    // Get a specific partner's summary
    const summary = await getPartnerMonthlySummary(parseInt(partnerId), month);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error in GET /api/partner-summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get partner summary' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partnerId, month, year } = body;

    // Support both new and old formats
    let monthString: string;
    
    if (month && year) {
      // New format with separate month and year
      monthString = formatMonthYear(parseInt(month), parseInt(year));
    } else if (body.monthString) {
      // Direct month string provided
      monthString = body.monthString;
    } else {
      return NextResponse.json(
        { success: false, error: 'Either month and year, or monthString is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: 'Partner ID is required' },
        { status: 400 }
      );
    }

    // Calculate and update the partner's monthly summary
    const summary = await calculatePartnerMonthlySummary(partnerId, monthString);
    
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error in POST /api/partner-summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update partner summary' },
      { status: 500 }
    );
  }
}
