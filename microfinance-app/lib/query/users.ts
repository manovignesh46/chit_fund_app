/**
 * Login accounts (the /users page, primary admin only).
 *
 *   const { data } = useUsers(enabled);       // GET /api/user?action=list-users
 *   await userWrites.create(body);            // POST /api/user?action=create-user
 *   await userWrites.remove(userId);          // POST /api/user?action=delete-user
 *
 * The writes are plain fetch calls with exactly the headers and bodies the page always
 * sent (credentials are involved: nothing is added). The server enforces who may call them.
 */
import useSWR from 'swr';
import { ApiError } from './fetcher';
import { invalidate } from './invalidate';
import { queryKeys, registerEndpoint, type QueryKey } from './keys';
import { PARTNERS } from './dashboard';

export const USERS = 'users';

registerEndpoint(USERS, (action) => `/user?action=${action === 'list' ? 'list-users' : action}`);

export interface UserPartner {
  id: number;
  name: string;
}

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
  partnerId?: number | null;
  dataOwnerId?: number | null;
  createdAt?: string;
  partner?: UserPartner | null;
}

/** Create-user body, in the key order the page has always sent. */
export interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  partnerId: number | null;
  role: string;
}

export const userKeys = {
  list: (): QueryKey => queryKeys.list(USERS),
  partners: (): QueryKey => queryKeys.list(PARTNERS),
};

export function useUsers(enabled: boolean) {
  return useSWR<{ users: AppUser[] }>(enabled ? userKeys.list() : null);
}

/** GET /api/partners (id, name, …) for the "Linked partner" choice. */
export function usePartnerOptions(enabled: boolean) {
  return useSWR<{ partners: UserPartner[] }>(enabled ? userKeys.partners() : null);
}

async function post<T>(action: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(`/api/user?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data.error === 'string' && data.error ? data.error : fallback;
    throw new ApiError(message, response.status, data);
  }
  return data as T;
}

export const userWrites = {
  create: (body: CreateUserBody) => post<AppUser>('create-user', body, 'Failed to create user'),
  remove: (userId: number) => post<{ success: boolean }>('delete-user', { userId }, 'Failed to delete user'),
};

/** After a create or delete: the account list and the partner list (which partners have a login). */
export function invalidateUsers(): Promise<void> {
  return invalidate([USERS, 'list'], [PARTNERS, 'list']);
}
