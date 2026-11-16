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
    return poultryRequest<any[]>('/customers?search=' + encodeURIComponent(search));
  },
  createCustomer(input: PoultryCustomerInput) {
    return poultryRequest<any>('/customers', { method: 'POST', body: JSON.stringify(input) });
  },
  getStatement(customerId: string, from: string, to: string) {
    return poultryRequest<any>('/customers/' + encodeURIComponent(customerId) + '/statement?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
  },
  createInvoice(customerId: string, input: PoultryInvoiceInput) {
    return poultryRequest<any>('/customers/' + encodeURIComponent(customerId) + '/invoices', { method: 'POST', body: JSON.stringify(input) });
  },
  collectPayment(customerId: string, amount: number) {
    return poultryRequest<any>('/customers/' + encodeURIComponent(customerId) + '/payments', { method: 'POST', body: JSON.stringify({ amount }) });
  },
  notifications() {
    return poultryRequest<any[]>('/notifications');
  },
};
