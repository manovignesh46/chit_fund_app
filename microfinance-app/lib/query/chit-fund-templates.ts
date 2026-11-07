/**
 * Chit fund templates data family: keys, reads, writes and invalidation.
 *
 *   const { data: template } = useChitFundTemplate(3);
 *   await templateWrites.update(3, body);
 *   await invalidateTemplates();
 *
 * Keys: ['chit-fund-templates', action, id, params]; URLs are the default consolidated
 * pattern (`/chit-fund-templates/consolidated?action=…&id=…`).
 */
import useSWR, { type SWRConfiguration } from 'swr';
import { apiFetch } from './fetcher';
import { invalidate, invalidateExcept, primeCache, type QueryTag } from './invalidate';
import { keyToEndpoint, queryKeys, type QueryKey, type QueryParams } from './keys';

export const TEMPLATES = 'chit-fund-templates';

export interface ChitFundTemplate {
  id: number;
  name: string;
  description: string | null;
  totalAmount: number;
  monthlyContribution: number;
  firstMonthContribution: number | null;
  duration: number;
  membersCount: number;
  chitFundType: string;
  /** { "1": 40000, "2": 45000, … } (Fixed type only). */
  fixedAmountsPattern: Record<string, number> | null;
  isArchived: boolean;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  _count?: { chitFunds: number };
}

/** Body of create/update, as TemplateForm has always built it. */
export type TemplateBody = Record<string, unknown>;

export const templateKeys = {
  list: (params?: QueryParams): QueryKey => queryKeys.list(TEMPLATES, params),
  /** Every non-archived template, newest first (the request the new-fund form always sent). */
  all: (): QueryKey => queryKeys.list(TEMPLATES),
  detail: (id: number): QueryKey => queryKeys.detail(TEMPLATES, id),
};

export const templateTag = (id: number): QueryTag => [TEMPLATES, undefined, id];

export function useChitFundTemplate(id: number | null, config?: SWRConfiguration<ChitFundTemplate>) {
  return useSWR<ChitFundTemplate>(id ? templateKeys.detail(id) : null, config);
}

export function useAllTemplates(enabled = true) {
  return useSWR<{ templates?: ChitFundTemplate[] }>(enabled ? templateKeys.all() : null);
}

/** Load one template now (e.g. when it is picked in the new-fund form); also fills the cache. */
export async function fetchTemplate(id: number): Promise<ChitFundTemplate> {
  const key = templateKeys.detail(id);
  const data = await apiFetch<ChitFundTemplate>(keyToEndpoint(key));
  primeCache(key, data);
  return data;
}

const consolidated = (action: string, id?: number) =>
  `/chit-fund-templates/consolidated?action=${action}${id !== undefined ? `&id=${id}` : ''}`;

export const templateWrites = {
  create: (body: TemplateBody) => apiFetch<ChitFundTemplate>(consolidated('create'), { method: 'POST', body }),
  update: (id: number, body: TemplateBody) => apiFetch<ChitFundTemplate>(consolidated('update', id), { method: 'PUT', body }),
  /** Soft-archive (the default delete): DELETE with `{}` as the body, as before. Existing funds are not affected. */
  archive: (id: number) => apiFetch<{ success?: boolean }>(consolidated('delete', id), { method: 'DELETE', body: '{}' }),
};

/**
 * After a template create/update/archive: every templates query (an archived template's
 * own page still loads: the detail endpoint returns archived templates), and the chit fund pages that
 * show a template's name (fund detail). Resolves when mounted queries refetch.
 */
export function invalidateTemplates(exclude: QueryTag[] = []): Promise<void> {
  return exclude.length ? invalidateExcept([TEMPLATES, ['chit-funds', 'detail']], exclude) : invalidate(TEMPLATES, ['chit-funds', 'detail']);
}

