export type PoultryCustomerRecord = {
  id: string;
  name: string;
  phone: string;
  shopName: string | null;
  shopAddress: string | null;
  createdAt?: string;
  updatedAt?: string;
};
export type PoultryCustomer = PoultryCustomerRecord & {
  balance: number;
  totalSales: number;
  totalPaid: number;
};
export type PoultryStatementRow = {
  id: string;
  type: 'invoice' | 'payment';
  invoiceNo: string | null;
  date: string;
  actorName: string;
  total: number;
  paid: number;
  note: string | null;
  items: Array<{ productName: string; quantityKg: number; unitPrice: number; total: number }>;
};
export type PoultryStatement = {
  customer: PoultryCustomerRecord;
  from: string | null;
  to: string | null;
  openingBalance: number;
  summary: { totalKg: number; sales: number; paid: number; remaining: number };
  rows: PoultryStatementRow[];
};
export type PoultryInvoiceResult = {
  id: string;
  invoiceNo: string;
  total: number;
  amountPaid: number;
  extraCollection: number;
  amountReceived: number;
  balance: number;
  createdAt: string;
  cashierName: string;
};
export type PoultryPaymentResult = {
  id: string;
  amount: number;
  createdAt: string;
  collectorName: string;
};
export type PoultryNotification = {
  id: string;
  type: 'invoice' | 'payment';
  title: string;
  detail: string;
  createdAt: string;
  href: string;
};
export type PoultryCustomerInput = { name: string; phone: string; shopName?: string; shopAddress?: string };
export type PoultryInvoiceInput = { items: Array<{ productName: string; quantityKg: number; unitPrice: number }>; amountPaid: number };

async function poultryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch('/api/xstore/poultry' + path, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : 'تعذر تنفيذ العملية.';
    throw new Error(message);
  }
  return payload as T;
}

export const poultryApi = {
  listCustomers(search = '') {
    return poultryRequest<PoultryCustomer[]>('/customers?search=' + encodeURIComponent(search));
  },
  createCustomer(input: PoultryCustomerInput) {
    return poultryRequest<PoultryCustomerRecord>('/customers', { method: 'POST', body: JSON.stringify(input) });
  },
  getStatement(customerId: string, from: string, to: string) {
    return poultryRequest<PoultryStatement>('/customers/' + encodeURIComponent(customerId) + '/statement?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
  },
  createInvoice(customerId: string, input: PoultryInvoiceInput) {
    return poultryRequest<PoultryInvoiceResult>('/customers/' + encodeURIComponent(customerId) + '/invoices', { method: 'POST', body: JSON.stringify(input) });
  },
  collectPayment(customerId: string, amount: number) {
    return poultryRequest<PoultryPaymentResult>('/customers/' + encodeURIComponent(customerId) + '/payments', { method: 'POST', body: JSON.stringify({ amount }) });
  },
  notifications() {
    return poultryRequest<PoultryNotification[]>('/notifications');
  },
};
