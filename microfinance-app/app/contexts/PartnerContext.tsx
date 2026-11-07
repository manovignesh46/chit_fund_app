'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { NativeSelect } from '@/components/kit/native-select';
import { clearAllCaches, revalidateAll } from '../../lib/query/invalidate';

// The selection dialog (Radix dialog/sheet) loads the first time it is needed, not with every page.
const PartnerSelectionModal = dynamic(() => import('../components/partners/PartnerSelectionModal'), { ssr: false });

interface Partner {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

/** The signed-in account, from /api/user?action=me (loaded once with the partners). */
export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface PartnerContextType {
  selectedPartner: Partner | null;
  setSelectedPartner: (partner: Partner | null) => void;
  partners: Partner[];
  loading: boolean;
  error: string | null;
  refreshPartners: () => Promise<void>;
  activePartner: string;
  otherPartner: string;
  partnerLocked: boolean;
  isPrimaryAdmin: boolean;
  currentUser: CurrentUser | null;
}

const PartnerContext = createContext(undefined);

interface PartnerProviderProps {
  children: React.ReactNode;
}

export function PartnerProvider({ children }: PartnerProviderProps) {
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partnerLocked, setPartnerLocked] = useState(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  // Mounted from the first time the dialog opens (keeps its close animation afterwards).
  const [partnerModalUsed, setPartnerModalUsed] = useState(false);
  useEffect(() => {
    if (showPartnerModal) setPartnerModalUsed(true);
  }, [showPartnerModal]);

  /** Who is signed in. Set from the profile alone, so it does not depend on the partners list. */
  const applyIdentity = (profile: any) => {
    setCurrentUser(profile?.id ? { id: profile.id, name: profile.name || '', email: profile.email || '', role: profile.role || '' } : null);
    setPartnerLocked(!!profile?.partnerLocked);
    setIsPrimaryAdmin(!!profile?.isPrimaryAdmin);
  };

  const refreshPartners = async (retryCount = 0) => {
    // Start the profile request alongside the partners request instead of after it.
    let profilePromise: Promise<{ res: Response | null; failure: unknown }> | null = null;
    let identityApplied = false;
    try {
      setLoading(true);
      setError(null);
      profilePromise = fetch('/api/user?action=me').then(
        (res) => ({ res, failure: null as unknown }),
        (failure) => ({ res: null as Response | null, failure })
      );
      const response = await fetch('/api/partners');
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMsg = 'Failed to fetch partners';
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      setPartners(data.partners || []);

      const profileResult = await profilePromise;
      if (!profileResult.res) throw profileResult.failure;
      const profileResponse = profileResult.res;
      let profileIsPrimaryAdmin = false;
      let profilePartnerLocked = false;

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        identityApplied = true;
        applyIdentity(profile);
        profilePartnerLocked = !!profile.partnerLocked;
        profileIsPrimaryAdmin = !!profile.isPrimaryAdmin;

        if (profile.partner?.id) {
          const linkedPartner = data.partners.find(
            (p: Partner) => p.id === profile.partner.id
          );
          if (linkedPartner) {
            setSelectedPartner(linkedPartner);
            setUserProfileLoaded(true);
            return;
          }
        }
      }

      setUserProfileLoaded(true);

      // Primary admin: restore saved partner or prompt selection
      if (profileIsPrimaryAdmin && !profilePartnerLocked) {
        const savedPartnerId = localStorage.getItem('selectedPartnerId');
        if (savedPartnerId) {
          const savedPartner = data.partners.find(
            (p: Partner) => p.id === parseInt(savedPartnerId)
          );
          if (savedPartner) {
            setSelectedPartner(savedPartner);
          } else {
            localStorage.removeItem('selectedPartnerId');
            localStorage.removeItem('selectedPartnerName');
          }
        }
      } else if (!profilePartnerLocked) {
        const savedPartnerId = localStorage.getItem('selectedPartnerId');
        if (savedPartnerId) {
          const savedPartner = data.partners.find(
            (p: Partner) => p.id === parseInt(savedPartnerId)
          );
          if (savedPartner) {
            setSelectedPartner(savedPartner);
          }
        }
      }
    } catch (err) {
      // The partners request failed: still record who is signed in, so pages that only need
      // the identity (users, settings) keep working. The partner prompt stays closed
      // (it needs userProfileLoaded and a partners list).
      if (profilePromise && !identityApplied) {
        try {
          const { res } = await profilePromise;
          if (res?.ok && !res.bodyUsed) applyIdentity(await res.json());
        } catch {
          /* the error below is what the user sees */
        }
      }
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch partners';
      if (errMsg.includes('Server did not return JSON') && retryCount < 3) {
        setTimeout(() => refreshPartners(retryCount + 1), 700);
        return;
      }
      console.error('Error fetching partners:', err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPartners();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      localStorage.setItem('selectedPartnerId', selectedPartner.id.toString());
      localStorage.setItem('selectedPartnerName', selectedPartner.name);
    }
  }, [selectedPartner]);

  // A change of partner lock means a different identity: drop every cached response.
  const identityRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userProfileLoaded) return;
    const identity = `${partnerLocked}|${isPrimaryAdmin}`;
    if (identityRef.current !== null && identityRef.current !== identity) clearAllCaches();
    identityRef.current = identity;
  }, [userProfileLoaded, partnerLocked, isPrimaryAdmin]);

  // Reads do not depend on the active partner (only writes send it), so switching
  // partner refreshes what is cached instead of clearing it. Restoring the saved
  // partner on load (none -> saved) is not a switch.
  const partnerIdRef = useRef<number | null>(null);
  useEffect(() => {
    const id = selectedPartner?.id ?? null;
    if (partnerIdRef.current !== null && id !== null && partnerIdRef.current !== id) void revalidateAll();
    if (id !== null) partnerIdRef.current = id;
  }, [selectedPartner]);

  // Show partner selection modal for primary admin when no partner is selected
  useEffect(() => {
    if (
      !loading &&
      userProfileLoaded &&
      isPrimaryAdmin &&
      !partnerLocked &&
      partners.length > 0 &&
      !selectedPartner
    ) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        setShowPartnerModal(true);
      }
    }
  }, [loading, userProfileLoaded, isPrimaryAdmin, partnerLocked, partners, selectedPartner]);

  const activePartner = selectedPartner?.name || 'Me';
  const otherPartner = partners.find(p => p.name !== activePartner)?.name || '';

  const value: PartnerContextType = {
    selectedPartner,
    setSelectedPartner,
    partners,
    loading,
    error,
    refreshPartners,
    activePartner,
    otherPartner,
    partnerLocked,
    isPrimaryAdmin,
    currentUser,
  };

  return (
    <PartnerContext.Provider value={value}>
      {children}
      {isPrimaryAdmin && !partnerLocked && partnerModalUsed && (
        <PartnerSelectionModal
          isOpen={showPartnerModal}
          onClose={() => setShowPartnerModal(false)}
          onPartnerSelected={() => setShowPartnerModal(false)}
        />
      )}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  const context = useContext(PartnerContext);
  if (context === undefined) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
}

interface PartnerSelectorProps {
  className?: string;
  label?: string;
  variant?: 'default' | 'header' | 'sidebar';
}

export function PartnerSelector({
  className = '',
  label = 'Active Partner',
  variant = 'default'
}: PartnerSelectorProps) {
  const { selectedPartner, setSelectedPartner, partners, loading, partnerLocked } = usePartner();
  const selectId = React.useId();

  if (loading) {
    return null;
  }

  // Partner accounts: read-only badge
  if (partnerLocked && selectedPartner) {
    return (
      <div className={`flex flex-row items-center gap-2 ${className}`.trim()}>
        <span className="hidden text-sm text-muted-foreground sm:inline">Logged in as</span>
        <span className="rounded-lg border border-primary-border bg-primary-subtle px-3 py-1.5 text-sm font-medium text-primary-text">
          {selectedPartner.name}
        </span>
      </div>
    );
  }

  const selectPartnerHandler = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = parseInt(e.target.value);
    const partner = partners.find(p => p.id === selectedId);
    setSelectedPartner(partner || null);
  };

  const options = partners.map((partner) => ({ value: String(partner.id), label: partner.name }));

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <NativeSelect
          aria-label="Active partner"
          value={selectedPartner?.id || ''}
          onChange={selectPartnerHandler}
          placeholder="Select Partner"
          options={options}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-row items-center gap-2 ${className}`.trim()}>
      {label && (
        <label htmlFor={selectId} className="mb-0 mr-1 block whitespace-nowrap text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <NativeSelect
        id={selectId}
        aria-label={label ? undefined : 'Active partner'}
        size="sm"
        value={selectedPartner?.id || ''}
        onChange={selectPartnerHandler}
        placeholder="Select Partner"
        options={options}
        className="min-w-[160px] font-medium"
      />
    </div>
  );
}
