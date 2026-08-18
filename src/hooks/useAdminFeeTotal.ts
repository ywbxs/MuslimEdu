import { useCallback, useEffect, useState } from 'react';
import { fetchAdminFeeList } from '../services/feeService';

interface AdminFeeTotal {
  totalCollected: number;
  loading: boolean;
}

/**
 * Sums every invoice's paid_amount from /admin_fee_list (via
 * fetchAdminFeeList) for the dashboard's Fee Reports quick stat. There's no
 * term-scoped or pre-aggregated summary endpoint, so this is an all-time
 * total across every invoice, not "this term" - label it accordingly
 * wherever it's shown.
 */
export function useAdminFeeTotal(token: string | null | undefined): AdminFeeTotal {
  const [totalCollected, setTotalCollected] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const invoices = await fetchAdminFeeList(token);
      setTotalCollected(invoices.reduce((sum, invoice) => sum + (invoice.paid_amount || 0), 0));
    } catch {
      // Fail-open: the card just shows nothing rather than throwing.
      setTotalCollected(0);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { totalCollected, loading };
}
