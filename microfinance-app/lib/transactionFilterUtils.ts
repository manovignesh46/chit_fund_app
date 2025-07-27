// Utility function to build transaction filter parameters
export interface TransactionFilters {
  selectedPartnerId?: string;
  filterType?: string;
  filterMember?: string;
  startDate?: string;
  endDate?: string;
  showAdvanced?: boolean;
  advType?: string;
  advMember?: string;
  advEntity?: string;
  advSubType?: string;
}

export function buildTransactionFilterParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.selectedPartnerId && filters.selectedPartnerId !== 'ALL') {
    params.append('partner', filters.selectedPartnerId);
  }
  if (filters.filterType) {
    params.append('type', filters.filterType);
  }
  if (filters.filterMember) {
    params.append('member', filters.filterMember);
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate);
  }
  if (filters.showAdvanced) {
    if (filters.advType) params.append('advType', filters.advType);
    if (filters.advMember) params.append('advMember', filters.advMember);
    if (filters.advEntity) params.append('advEntity', filters.advEntity);
    if (filters.advSubType) params.append('advSubType', filters.advSubType);
  }

  return params;
}

export function buildTransactionFilterObject(filters: TransactionFilters) {
  const filterObject: any = {};
  
  if (filters.selectedPartnerId && filters.selectedPartnerId !== 'ALL') {
    filterObject.partner = filters.selectedPartnerId;
  }
  if (filters.filterType) {
    filterObject.type = filters.filterType;
  }
  if (filters.filterMember) {
    filterObject.member = filters.filterMember;
  }
  if (filters.startDate) {
    filterObject.startDate = filters.startDate;
  }
  if (filters.endDate) {
    filterObject.endDate = filters.endDate;
  }
  if (filters.showAdvanced) {
    if (filters.advType) filterObject.advType = filters.advType;
    if (filters.advMember) filterObject.advMember = filters.advMember;
    if (filters.advEntity) filterObject.advEntity = filters.advEntity;
    if (filters.advSubType) filterObject.advSubType = filters.advSubType;
  }

  return filterObject;
}
