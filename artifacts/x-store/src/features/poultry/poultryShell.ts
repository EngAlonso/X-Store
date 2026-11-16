import { useEffect, useState } from 'react';
import { ReceiptText, Users, Wallet } from 'lucide-react';
import type { SessionUser } from '@workspace/api-client-react';
import { poultryApi } from './poultryApi';

export type PoultryNavigationItem = {
  href: string;
  label: string;
  icon: typeof Users;
};

export function getPoultryNavigation(user: SessionUser): PoultryNavigationItem[] {
  const permissions = user.permissions || [];
  const isAdmin = user.role === 'tenant_admin' || user.role === 'cashier';
  const canViewCustomers = isAdmin || user.role === 'accountant' ||
    (user.role === 'custom' && permissions.some(permission =>
      ['customer_management', 'accountant', 'collector', 'retail_sales'].includes(permission),
    ));
  const canSell = isAdmin || (user.role === 'custom' && permissions.includes('retail_sales'));
  const canCollect = isAdmin || (user.role === 'custom' && permissions.includes('collector'));

  return [
    ...(canViewCustomers ? [{ href: '/poultry-customers', label: 'العملاء', icon: Users }] : []),
    ...(canSell ? [{ href: '/poultry-sales', label: 'البيع', icon: ReceiptText }] : []),
    ...(canCollect ? [{ href: '/poultry-collections', label: 'التحصيل', icon: Wallet }] : []),
  ];
}

export type PoultryNotification = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  href: string;
  type?: 'invoice' | 'payment';
};

export function usePoultryNotifications(enabled: boolean, userId?: string) {
  const [notifications, setNotifications] = useState<PoultryNotification[]>([]);
  useEffect(() => {
    if (!enabled || !userId) {
      setNotifications([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const result = await poultryApi.notifications();
        if (!cancelled) setNotifications(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setNotifications([]);
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, userId]);
  return notifications;
}
