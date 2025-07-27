// Utility function to generate descriptive names for transaction exports based on applied filters
export function generateTransactionExportName(filters: {
  partner?: string;
  type?: string;
  member?: string;
  startDate?: string;
  endDate?: string;
  advType?: string;
  advMember?: string;
  advEntity?: string;
  advSubType?: string;
}, partnerNames?: Record<string, string>, memberNames?: Record<string, string>): {
  filename: string;
  subject: string;
  description: string;
} {
  const parts: string[] = [];
  const dateParts: string[] = [];
  
  // Helper function to format date for display
  const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };
  
  // Date range
  if (filters.startDate && filters.endDate) {
    if (filters.startDate === filters.endDate) {
      dateParts.push(`${formatDateDisplay(filters.startDate)}`);
    } else {
      dateParts.push(`${formatDateDisplay(filters.startDate)} to ${formatDateDisplay(filters.endDate)}`);
    }
  } else if (filters.startDate) {
    dateParts.push(`From ${formatDateDisplay(filters.startDate)}`);
  } else if (filters.endDate) {
    dateParts.push(`Until ${formatDateDisplay(filters.endDate)}`);
  }
  
  // Partner filter
  if (filters.partner && filters.partner !== 'ALL') {
    const partnerName = partnerNames?.[filters.partner] || `Partner-${filters.partner}`;
    parts.push(partnerName);
  }
  
  // Advanced filters
  if (filters.advType) {
    if (filters.advType === 'loan') {
      if (filters.advSubType === 'disbursement') {
        parts.push('Loan Disbursements');
      } else if (filters.advSubType === 'repayment') {
        parts.push('Loan Repayments');
      } else {
        parts.push('Loan Transactions');
      }
      
      // Add member name if filtering by member
      if (filters.advMember && memberNames?.[filters.advMember]) {
        parts.push(`for ${memberNames[filters.advMember]}`);
      }
    } else if (filters.advType === 'chit') {
      if (filters.advSubType === 'contribution') {
        parts.push('Chit Contributions');
      } else if (filters.advSubType === 'auction') {
        parts.push('Auction Payouts');
      } else {
        parts.push('Chit Fund Transactions');
      }
      
      // Add member name if filtering by member
      if (filters.advMember && memberNames?.[filters.advMember]) {
        parts.push(`for ${memberNames[filters.advMember]}`);
      }
    }
  } else {
    // Basic filters
    if (filters.type) {
      const typeDisplay = filters.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      parts.push(typeDisplay);
    }
    
    if (filters.member) {
      parts.push(`Member: ${filters.member}`);
    }
  }
  
  // Build final strings
  const currentDate = new Date().toISOString().split('T')[0];
  
  let baseName = 'Transactions';
  if (parts.length > 0) {
    baseName = parts.join(' ');
  }
  
  let description = 'All Transactions';
  if (parts.length > 0 || dateParts.length > 0) {
    const filterParts = [...parts];
    if (dateParts.length > 0) {
      filterParts.push(`(${dateParts.join(', ')})`);
    }
    description = filterParts.join(' ');
  } else if (dateParts.length > 0) {
    description = `Transactions ${dateParts.join(', ')}`;
  }
  
  // Generate filename (clean for filesystem)
  const cleanBaseName = baseName
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase();
  
  const filename = `${cleanBaseName}-${currentDate}.xlsx`;
  
  // Generate subject
  const subject = `Transaction Export - ${description}`;
  
  return {
    filename,
    subject,
    description
  };
}
