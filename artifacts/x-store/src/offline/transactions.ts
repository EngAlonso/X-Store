import {
  calculateSaleItemReturn,
  type OfflineExchange,
  type OfflinePaymentMethod,
  type OfflineReturn,
  type OfflineSale,
  type OfflineState,
} from "./model";

export type OfflineReturnRequest = {
  saleId: string;
  items: { productId: string; quantity: number }[];
  reason: string;
  actorName?: string;
};

export type OfflineExchangeRequest = OfflineReturnRequest & {
  replacementProductId: string;
  replacementQuantity: number;
  paymentMethod: OfflinePaymentMethod;
  amountReceived: number;
};

export function createAuditEntry(
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  actorName = "صاحب المتجر",
) {
  return {
    id: createId(),
    actorName,
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date().toISOString(),
  };
}

export function applyOfflineReturn(
  state: OfflineState,
  request: OfflineReturnRequest,
): { state: OfflineState; refundAmount: number } {
  const sale = state.sales.find((item) => item.id === request.saleId);
  if (!sale) throw new Error("لم يتم العثور على الفاتورة المحددة.");
  const lines = normalizeReturnLines(request.items);
  if (!lines.length) throw new Error("حدد كمية واحدة على الأقل للإرجاع.");

  const products = [...state.products];
  const saleLines = sale.items.map((item) => ({ ...item }));
  const returnItems: OfflineReturn["items"] = [];
  let refundAmount = 0;
  let costAmount = 0;

  for (const requested of lines) {
    const saleLine = saleLines.find((item) => item.productId === requested.productId);
    const productIndex = products.findIndex((item) => item.id === requested.productId);
    if (!saleLine || productIndex < 0) {
      throw new Error("تعذر العثور على صنف الفاتورة أو المنتج في المخزون.");
    }
    const remaining = remainingReturnableQuantity(state, sale, saleLine);
    if (requested.quantity > remaining) {
      throw new Error(`الكمية المطلوب إرجاعها تتجاوز المتبقي من ${saleLine.name}.`);
    }

    const amounts = calculateSaleItemReturn(sale, saleLine, requested.quantity);
    saleLine.returnedQuantity += requested.quantity;
    products[productIndex] = {
      ...products[productIndex],
      quantity: products[productIndex].quantity + requested.quantity,
    };
    returnItems.push({
      productId: saleLine.productId,
      name: saleLine.name,
      quantity: requested.quantity,
      refundAmount: amounts.refundAmount,
      costAmount: amounts.costAmount,
    });
    refundAmount += amounts.refundAmount;
    costAmount += amounts.costAmount;
  }

  refundAmount = roundMoney(refundAmount);
  const record: OfflineReturn = {
    id: createId(),
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    createdAt: new Date().toISOString(),
    reason: request.reason.trim(),
    cashierName: request.actorName ?? "صاحب المتجر",
    items: returnItems,
    refundAmount,
    costAmount: roundMoney(costAmount),
  };

  return {
    refundAmount,
    state: {
      ...state,
      products,
      sales: state.sales.map((item) => item.id === sale.id ? { ...item, items: saleLines } : item),
      returns: [record, ...state.returns],
      auditLogs: [
        createAuditEntry("تسجيل مرتجع", "فاتورة بيع", sale.invoiceNumber, `${returnItems.reduce((sum, item) => sum + item.quantity, 0)} وحدة · ${request.reason.trim()}`, request.actorName),
        ...state.auditLogs,
      ],
    },
  };
}

export function applyOfflineExchange(
  state: OfflineState,
  request: OfflineExchangeRequest,
): { state: OfflineState; exchange: OfflineExchange } {
  const original = state.sales.find((item) => item.id === request.saleId);
  if (!original) throw new Error("لم يتم العثور على فاتورة البيع الأصلية.");
  const returnLines = normalizeReturnLines(request.items);
  if (!returnLines.length) throw new Error("حدد صنفًا واحدًا على الأقل لاستبداله.");
  if (!Number.isInteger(request.replacementQuantity) || request.replacementQuantity < 1) {
    throw new Error("أدخل كمية صحيحة للمنتج البديل.");
  }

  const products = [...state.products];
  const saleLines = original.items.map((item) => ({ ...item }));
  const returnItems: OfflineReturn["items"] = [];
  const stockAfterReturns = new Map(products.map((product) => [product.id, product.quantity]));
  let refundAmount = 0;
  let returnedCost = 0;

  for (const requested of returnLines) {
    const saleLine = saleLines.find((item) => item.productId === requested.productId);
    const product = products.find((item) => item.id === requested.productId);
    if (!saleLine || !product) {
      throw new Error("تعذر العثور على صنف الفاتورة أو المنتج في المخزون.");
    }
    const remaining = remainingReturnableQuantity(state, original, saleLine);
    if (requested.quantity > remaining) {
      throw new Error(`الكمية المطلوب إرجاعها تتجاوز المتبقي من ${saleLine.name}.`);
    }

    const amounts = calculateSaleItemReturn(original, saleLine, requested.quantity);
    saleLine.returnedQuantity += requested.quantity;
    stockAfterReturns.set(product.id, (stockAfterReturns.get(product.id) ?? 0) + requested.quantity);
    returnItems.push({
      productId: product.id,
      name: saleLine.name,
      quantity: requested.quantity,
      refundAmount: amounts.refundAmount,
      costAmount: amounts.costAmount,
    });
    refundAmount += amounts.refundAmount;
    returnedCost += amounts.costAmount;
  }
  refundAmount = roundMoney(refundAmount);

  const replacementIndex = products.findIndex((product) => product.id === request.replacementProductId);
  const replacement = products[replacementIndex];
  if (!replacement) throw new Error("لم يتم العثور على المنتج البديل.");
  const replacementPrice = original.saleType === "wholesale"
    ? replacement.wholesalePrice
    : replacement.price;
  const availableAfterReturns = stockAfterReturns.get(replacement.id) ?? replacement.quantity;
  if (replacementPrice === null) {
    throw new Error(`لا يوجد سعر ${original.saleType === "wholesale" ? "جملة" : "قطاعي"} للمنتج البديل.`);
  }
  if (availableAfterReturns < request.replacementQuantity) {
    throw new Error("الكمية المطلوبة من المنتج البديل غير متاحة في المخزون.");
  }

  const subtotal = roundMoney(replacementPrice * request.replacementQuantity);
  const taxAmount = roundMoney(subtotal * (state.store?.vatRate ?? 0) / 100);
  const total = roundMoney(subtotal + taxAmount);
  const balanceDue = roundMoney(total - refundAmount);
  const amountReceived = roundMoney(Math.max(0, request.amountReceived));
  const changeAmount = balanceDue < 0
    ? roundMoney(Math.abs(balanceDue))
    : roundMoney(Math.max(0, amountReceived - balanceDue));
  const createdAt = new Date().toISOString();
  const replacementInvoiceNumber = createInvoiceNumber(createdAt);
  const exchange: OfflineExchange = {
    id: createId(),
    originalInvoiceNumber: original.invoiceNumber,
    replacementInvoiceNumber,
    createdAt,
    returnedAmount: refundAmount,
    replacementAmount: total,
    balanceDue,
    changeAmount,
  };

  const replacementSale: OfflineSale = {
    id: createId(),
    invoiceNumber: replacementInvoiceNumber,
    createdAt,
    customerName: original.customerName,
    customerPhone: original.customerPhone,
    paymentMethod: request.paymentMethod,
    saleType: original.saleType,
    transferSender: "",
    items: [{
      productId: replacement.id,
      name: replacement.name,
      sku: replacement.sku,
      quantity: request.replacementQuantity,
      unitPrice: replacementPrice,
      unitCost: replacement.costPrice,
      lineTotal: subtotal,
      returnedQuantity: 0,
    }],
    subtotal,
    discountAmount: 0,
    taxAmount,
    total,
    amountReceived,
    changeAmount,
    cashierName: request.actorName ?? "صاحب المتجر",
    exchangeOfInvoiceNumber: original.invoiceNumber,
  };

  const updatedProducts = products.map((product) => {
    let quantity = stockAfterReturns.get(product.id) ?? product.quantity;
    if (product.id === replacement.id) quantity -= request.replacementQuantity;
    return quantity === product.quantity ? product : { ...product, quantity };
  });
  const returnRecord: OfflineReturn = {
    id: createId(),
    saleId: original.id,
    invoiceNumber: original.invoiceNumber,
    createdAt,
    reason: request.reason.trim() ? `استبدال · ${request.reason.trim()}` : "استبدال",
    cashierName: request.actorName ?? "صاحب المتجر",
    items: returnItems,
    refundAmount,
    costAmount: roundMoney(returnedCost),
  };

  return {
    exchange,
    state: {
      ...state,
      products: updatedProducts,
      sales: [
        replacementSale,
        ...state.sales.map((item) => item.id === original.id ? { ...item, items: saleLines } : item),
      ],
      returns: [returnRecord, ...state.returns],
      exchanges: [exchange, ...state.exchanges],
      auditLogs: [
        createAuditEntry("تسجيل استبدال", "فاتورة بيع", replacementInvoiceNumber, `الأصلية ${original.invoiceNumber} · المرتجع ${roundMoney(refundAmount)} · البديل ${roundMoney(total)}`, request.actorName),
        ...state.auditLogs,
      ],
    },
  };
}

function normalizeReturnLines(items: OfflineReturnRequest["items"]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("تحقق من الأصناف والكميات المحددة.");
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

function remainingReturnableQuantity(
  state: OfflineState,
  sale: OfflineSale,
  line: OfflineSale["items"][number],
) {
  const quantityInReturnRecords = state.returns
    .filter((record) => record.saleId === sale.id)
    .flatMap((record) => record.items)
    .filter((item) => item.productId === line.productId)
    .reduce((sum, item) => sum + item.quantity, 0);
  return Math.max(0, line.quantity - Math.max(line.returnedQuantity, quantityInReturnRecords));
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createInvoiceNumber(createdAt: string) {
  const day = createdAt.slice(2, 10).replaceAll("-", "");
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `XS-${day}-${code}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
