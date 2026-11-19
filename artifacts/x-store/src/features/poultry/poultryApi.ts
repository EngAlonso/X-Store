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
  type: 'invoice' | 'payment' | 'manual_debt';
  invoiceNo: string | null;
  date: string;
  actorName: string;
  total: number;
  paid: number;
  note: string | null;
  items: Array<{ productName: string; quantityKg: number; unitPrice: number; total: number; deadWeightKg: number; deadTotal: number }>;
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
  deadWeightKg: number;
  deadTotal: number;
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
export type PoultryInvoiceListItem = {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  shopName: string | null;
  phone: string;
  cashierName: string;
  total: number;
  amountPaid: number;
  balance: number;
  amountReceived: number;
  extraCollection: number;
  items: Array<{ productName: string; quantityKg: number; unitPrice: number; total: number; deadWeightKg: number; deadTotal: number }>;
};
export type PoultryInvoiceListResponse = {
  invoices: PoultryInvoiceListItem[];
  summary: { count: number; sales: number; paid: number; outstanding: number; totalKg: number };
};

export type PoultryFinancialReport = {
  from: string; to: string; invoiceCount: number; totalSales: number; totalCollected: number;
  outstanding: number; totalKg: number; customerCount: number; averageInvoice: number;
  costOfGoodsSold: number; grossProfit: number;
};
export type PoultryFarmSummary={stock:Array<{productName:string;quantityKg:number;costValue:number}>;movements:Array<{id:string;type:'in'|'out';productName:string;quantityKg:number;unitCost:number;totalCost:number;note:string|null;invoiceId:string|null;createdAt:string}>;summary:{currentKg:number;currentCostValue:number;periodInKg:number;periodOutKg:number;periodInCost:number;periodOutCost:number}};
export type PoultryNotification = {
  id: string;
  type: 'invoice' | 'payment';
  title: string;
  detail: string;
  createdAt: string;
  href: string;
};
export type PoultryCustomerInput = { name: string; phone?: string; shopName?: string; shopAddress?: string };
export type PoultryInvoiceInput = { items: Array<{ productName: string; quantityKg: number; unitPrice: number; deadWeightKg?: number }>; amountPaid: number };

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
  updateCustomer(customerId: string, input: PoultryCustomerInput) {
    return poultryRequest<PoultryCustomerRecord>('/customers/' + encodeURIComponent(customerId), { method: 'PATCH', body: JSON.stringify(input) });
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
  addManualDebt(customerId: string, amount: number, note: string) {
    return poultryRequest<PoultryPaymentResult>('/customers/' + encodeURIComponent(customerId) + '/manual-debt', { method: 'POST', body: JSON.stringify({ amount, note }) });
  },
  listInvoices(from = '', to = '', search = '') {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (search) params.set('search', search);
    const query = params.toString();
    return poultryRequest<PoultryInvoiceListResponse>('/invoices' + (query ? '?' + query : ''));
  },
  financialReport(from: string, to: string) { return poultryRequest<PoultryFinancialReport>('/reports/financial?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)); },
  farmSummary(from='',to=''){const params=new URLSearchParams();if(from)params.set('from',from);if(to)params.set('to',to);return poultryRequest<PoultryFarmSummary>('/farm/summary'+(params.toString()?'?'+params.toString():''));},
  addFarmEntry(input:{productName:string;quantityKg:number;unitCost:number;note?:string}){return poultryRequest<{id:string;productName:string;quantityKg:number;unitCost:number;note:string|null;createdAt:string}>('/farm/entries',{method:'POST',body:JSON.stringify(input)});},
  notifications() {
    return poultryRequest<PoultryNotification[]>('/notifications');
  },
};
