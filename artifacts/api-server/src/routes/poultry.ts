import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  db, xstoreAuditLogs, xstoreCustomers, xstorePoultryInvoices,
  xstorePoultryInvoiceItems, xstorePoultryPayments, xstorePoultryFarmLots, xstorePoultryFarmMovements, xstoreTenants, xstoreUsers,
  type XStoreUser,
} from "@workspace/db";
import { getXStoreUser, hasRole, requireXStoreUser } from "../middlewares/xstoreAuth";

const router: IRouter = Router();
router.use("/xstore", requireXStoreUser);

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const toNumber = (value: string | number | null | undefined) => Number(value ?? 0);
const iso = (value: Date) => value.toISOString();

class DomainError extends Error {
  constructor(message: string, readonly statusCode = 409) {
    super(message);
  }
}

async function audit(
  actor: XStoreUser,
  action: string,
  tenantId: string | null,
  entityType: string,
  entityId: string | null,
  details: string,
) {
  await db.insert(xstoreAuditLogs).values({
    actorUserId: actor.id,
    actorName: actor.name,
    action,
    tenantId,
    entityType,
    entityId,
    details,
  });
}

const poultryUserRoles = ["tenant_admin", "cashier", "accountant", "collector", "retail_sales", "customer_management"] as const;

async function ensurePoultryTenantAccess(user: XStoreUser, res: Response): Promise<boolean> {
  if (!user.tenantId) {
    res.status(403).json({ error: "لا يوجد متجر مرتبط بالحساب." });
    return false;
  }
  const [tenant] = await db
    .select({ storeType: xstoreTenants.storeType })
    .from(xstoreTenants)
    .where(eq(xstoreTenants.id, user.tenantId))
    .limit(1);
  if (tenant?.storeType !== "poultry") {
    res.status(403).json({ error: "هذه الخدمة متاحة لمتاجر الدواجن فقط." });
    return false;
  }
  return true;
}

function normalizeFarmProductName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\\u0640]/g, "")
    .replace(/[\\u064B-\\u065F\\u0670]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim()
    .replace(/\\s+/g, " ")
    .toLowerCase();
}
async function consumeFarmStock(tx: any, tenantId: string, productName: string, quantityKg: number, invoiceId: string, actorUserId: string) {
  const requestedName=normalizeFarmProductName(productName);
  const result=await tx.execute(sql`select id, product_name, remaining_kg, unit_cost from xstore_poultry_farm_lots where tenant_id=${tenantId} and remaining_kg>0 order by created_at asc,id asc for update`) as {rows:Array<{id:string;product_name:string;remaining_kg:string;unit_cost:string}>};
  const grouped=new Map<string,Array<{id:string;product_name:string;remaining_kg:string;unit_cost:string}>>();
  for(const row of result.rows){
    const key=normalizeFarmProductName(row.product_name);
    const list=grouped.get(key) || [];
    list.push(row);
    grouped.set(key,list);
  }

  let matchedKey=requestedName;
  if(!grouped.has(matchedKey)){
    const candidates=[...grouped.keys()].filter(key => key.includes(requestedName) || requestedName.includes(key));
    if(candidates.length===1) matchedKey=candidates[0];
  }

  const rows=grouped.get(matchedKey) || [];
  const availableKg=rows.reduce((sum,row)=>sum+toNumber(row.remaining_kg),0);
  if(!rows.length){
    const availableNames=[...grouped.values()].map(list=>list[0]?.product_name).filter(Boolean).slice(0,8).join("، ");
    throw new DomainError(
      availableNames
        ? `الصنف "${productName}" غير مطابق لصنف موجود في المزرعة. الأصناف المتاحة: ${availableNames}.`
        : `لا يوجد رصيد متاح في المزرعة للصنف "${productName}".`,
      409,
    );
  }
  if(availableKg+0.000001<quantityKg) {
    throw new DomainError(`رصيد المزرعة من ${rows[0].product_name} غير كافٍ. المتاح ${roundMoney(availableKg)} كجم والمطلوب ${roundMoney(quantityKg)} كجم.`,409);
  }

  const stockProductName=rows[0].product_name;
  let left=quantityKg,totalCost=0;
  for(const row of rows){
    if(left<=0)break;
    const lotRemaining=toNumber(row.remaining_kg);
    const takeKg=Math.min(lotRemaining,left);
    const unitCost=toNumber(row.unit_cost);
    const takeCost=roundMoney(takeKg*unitCost);
    await tx.update(xstorePoultryFarmLots)
      .set({remainingKg:String(Math.max(0,roundMoney(lotRemaining-takeKg)))})
      .where(eq(xstorePoultryFarmLots.id,row.id));
    await tx.insert(xstorePoultryFarmMovements).values({
      tenantId,
      lotId:row.id,
      invoiceId,
      actorUserId,
      movementType:"out",
      productName:stockProductName,
      quantityKg:String(takeKg),
      unitCost:String(unitCost),
      totalCost:String(takeCost),
      note:`صرف تلقائي مع الفاتورة ${invoiceId}`,
    });
    totalCost+=takeCost;
    left=roundMoney(left-takeKg);
  }
  return roundMoney(totalCost);
}
router.get("/xstore/poultry/farm/summary", async (req,res): Promise<void> => {
  const user=getXStoreUser(res);if(!user.tenantId||!hasRole(user,["tenant_admin","warehouse_manager"])){res.status(403).json({error:"ليس لديك صلاحية لإدارة المزرعة."});return;}if(!(await ensurePoultryTenantAccess(user,res)))return;
  const from=typeof req.query.from==="string"&&req.query.from?new Date(req.query.from+"T00:00:00+02:00"):null;const to=typeof req.query.to==="string"&&req.query.to?new Date(req.query.to+"T23:59:59.999+02:00"):null;if((from&&Number.isNaN(from.getTime()))||(to&&Number.isNaN(to.getTime()))||(from&&to&&from>to)){res.status(400).json({error:"الفترة الزمنية غير صحيحة."});return;}
  const [lots,movements]=await Promise.all([db.select().from(xstorePoultryFarmLots).where(eq(xstorePoultryFarmLots.tenantId,user.tenantId)).orderBy(desc(xstorePoultryFarmLots.createdAt)),db.select().from(xstorePoultryFarmMovements).where(eq(xstorePoultryFarmMovements.tenantId,user.tenantId)).orderBy(desc(xstorePoultryFarmMovements.createdAt))]);
  const stock=new Map<string,{productName:string;quantityKg:number;costValue:number}>();for(const lot of lots){const key=lot.productName.trim().toLowerCase();const cur=stock.get(key)||{productName:lot.productName,quantityKg:0,costValue:0};const q=toNumber(lot.remainingKg);cur.quantityKg=roundMoney(cur.quantityKg+q);cur.costValue=roundMoney(cur.costValue+q*toNumber(lot.unitCost));stock.set(key,cur);}const filtered=movements.filter(m=>(!from||m.createdAt>=from)&&(!to||m.createdAt<=to));
  res.json({stock:Array.from(stock.values()).filter(r=>r.quantityKg>0).sort((a,b)=>a.productName.localeCompare(b.productName,"ar")),movements:filtered.map(m=>({id:m.id,type:m.movementType,productName:m.productName,quantityKg:toNumber(m.quantityKg),unitCost:toNumber(m.unitCost),totalCost:toNumber(m.totalCost),note:m.note,invoiceId:m.invoiceId,createdAt:iso(m.createdAt)})),summary:{currentKg:roundMoney(Array.from(stock.values()).reduce((sum,r)=>sum+r.quantityKg,0)),currentCostValue:roundMoney(Array.from(stock.values()).reduce((sum,r)=>sum+r.costValue,0)),periodInKg:roundMoney(filtered.filter(m=>m.movementType==="in").reduce((sum,m)=>sum+toNumber(m.quantityKg),0)),periodOutKg:roundMoney(filtered.filter(m=>m.movementType==="out").reduce((sum,m)=>sum+toNumber(m.quantityKg),0)),periodInCost:roundMoney(filtered.filter(m=>m.movementType==="in").reduce((sum,m)=>sum+toNumber(m.totalCost),0)),periodOutCost:roundMoney(filtered.filter(m=>m.movementType==="out").reduce((sum,m)=>sum+toNumber(m.totalCost),0))}});
});
router.post("/xstore/poultry/farm/entries", async (req,res): Promise<void> => {
  const user=getXStoreUser(res);if(!user.tenantId||!hasRole(user,["tenant_admin","warehouse_manager"])){res.status(403).json({error:"ليس لديك صلاحية لإضافة بضاعة للمزرعة."});return;}if(!(await ensurePoultryTenantAccess(user,res)))return;
  const productName=normalizeFarmProductName(typeof req.body?.productName==="string"?req.body.productName:"");const quantityKg=Number(req.body?.quantityKg);const unitCost=Number(req.body?.unitCost);const note=typeof req.body?.note==="string"?req.body.note.trim():"";
  if(!productName){res.status(400).json({error:"اسم الصنف مطلوب."});return;}if(!Number.isFinite(quantityKg)||quantityKg<=0){res.status(400).json({error:"أدخل كمية بالكيلو أكبر من صفر."});return;}if(!Number.isFinite(unitCost)||unitCost<0){res.status(400).json({error:"أدخل سعر تكلفة صحيح لكل كيلو."});return;}
  const created=await db.transaction(async tx=>{const [lot]=await tx.insert(xstorePoultryFarmLots).values({tenantId:user.tenantId!,productName,receivedKg:String(roundMoney(quantityKg)),remainingKg:String(roundMoney(quantityKg)),unitCost:String(roundMoney(unitCost)),note:note||null}).returning();if(!lot)throw new DomainError("تعذر حفظ دفعة المزرعة.",500);await tx.insert(xstorePoultryFarmMovements).values({tenantId:user.tenantId!,lotId:lot.id,actorUserId:user.id,movementType:"in",productName,quantityKg:String(roundMoney(quantityKg)),unitCost:String(roundMoney(unitCost)),totalCost:String(roundMoney(quantityKg*unitCost)),note:note||null});return lot;});
  await audit(user,"poultry.farm_stock_received",user.tenantId,"poultry_farm_lot",created.id,`تم إدخال ${roundMoney(quantityKg)} كجم من ${productName} بتكلفة ${roundMoney(unitCost)} للكيلو`);res.status(201).json({id:created.id,productName:created.productName,quantityKg:roundMoney(quantityKg),unitCost:roundMoney(unitCost),note:created.note,createdAt:iso(created.createdAt)});
});
router.get("/xstore/poultry/customers", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, poultryUserRoles)) { res.status(403).json({ error: "ليس لديك صلاحية للوصول إلى حسابات العملاء." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.tenantId, user.tenantId), search ? or(ilike(xstoreCustomers.name, "%" + search + "%"), ilike(xstoreCustomers.phone, "%" + search + "%"), ilike(xstoreCustomers.shopName, "%" + search + "%")) : undefined)).orderBy(desc(xstoreCustomers.updatedAt)).limit(100);
  const invoices = await db.select().from(xstorePoultryInvoices).where(eq(xstorePoultryInvoices.tenantId, user.tenantId));
  const payments = await db.select().from(xstorePoultryPayments).where(eq(xstorePoultryPayments.tenantId, user.tenantId));
  res.json(rows.map(customer => {
    const sales = invoices.filter(x => x.customerId === customer.id).reduce((s, x) => s + toNumber(x.total), 0);
    const paid = invoices.filter(x => x.customerId === customer.id).reduce((s, x) => s + toNumber(x.amountPaid), 0) + payments.filter(x => x.customerId === customer.id).reduce((s, x) => s + toNumber(x.amount), 0);
    return { ...customer, createdAt: iso(customer.createdAt), updatedAt: iso(customer.updatedAt), totalSales: sales, totalPaid: paid, balance: roundMoney(sales - paid) };
  }));
});

router.post("/xstore/poultry/customers", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "cashier", "customer_management"])) { res.status(403).json({ error: "ليس لديك صلاحية إضافة عميل." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const shopName = typeof req.body?.shopName === "string" ? req.body.shopName.trim() : "";
  const shopAddress = typeof req.body?.shopAddress === "string" ? req.body.shopAddress.trim() : "";
  if (!name) { res.status(400).json({ error: "اسم العميل مطلوب." }); return; }
  const [customer] = await db.insert(xstoreCustomers).values({ tenantId: user.tenantId, name, phone: phone || "", shopName: shopName || null, shopAddress: shopAddress || null }).returning();
  if (!customer) { res.status(500).json({ error: "تعذر إنشاء العميل." }); return; }
  try {
    await audit(user, "poultry.customer_created", user.tenantId, "poultry_customer", customer.id, "تم إضافة العميل " + name);
  } catch (error) {
    console.error("Poultry customer audit failed after successful customer creation:", error);
  }
  res.status(201).json({ ...customer, createdAt: iso(customer.createdAt), updatedAt: iso(customer.updatedAt) });
});

router.patch("/xstore/poultry/customers/:customerId", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "customer_management"])) { res.status(403).json({ error: "ليس لديك صلاحية تعديل بيانات العميل." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const [existing] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id, req.params.customerId), eq(xstoreCustomers.tenantId, user.tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "العميل غير موجود." }); return; }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const shopName = typeof req.body?.shopName === "string" ? req.body.shopName.trim() : "";
  const shopAddress = typeof req.body?.shopAddress === "string" ? req.body.shopAddress.trim() : "";
  if (!name) { res.status(400).json({ error: "اسم العميل مطلوب." }); return; }
  const [customer] = await db.update(xstoreCustomers).set({ name, phone, shopName: shopName || null, shopAddress: shopAddress || null, updatedAt: new Date() }).where(and(eq(xstoreCustomers.id, existing.id), eq(xstoreCustomers.tenantId, user.tenantId))).returning();
  if (!customer) { res.status(500).json({ error: "تعذر تحديث بيانات العميل." }); return; }
  try {
    await audit(user, "poultry.customer_updated", user.tenantId, "poultry_customer", customer.id, "تم تعديل بيانات العميل " + name);
  } catch (error) {
    console.error("Poultry customer audit failed after successful customer update:", error);
  }
  res.json({ ...customer, createdAt: iso(customer.createdAt), updatedAt: iso(customer.updatedAt) });
});

router.get("/xstore/poultry/customers/:customerId/statement", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, poultryUserRoles)) { res.status(403).json({ error: "ليس لديك صلاحية لعرض كشف الحساب." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const [customer] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id, req.params.customerId), eq(xstoreCustomers.tenantId, user.tenantId))).limit(1);
  if (!customer) { res.status(404).json({ error: "العميل غير موجود." }); return; }
  const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from + "T00:00:00+02:00") : new Date("1970-01-01T00:00:00Z");
  const to = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to + "T23:59:59.999+02:00") : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) { res.status(400).json({ error: "الفترة الزمنية غير صحيحة." }); return; }
  const allInvoices = await db.select({ invoice: xstorePoultryInvoices, cashierName: xstoreUsers.name }).from(xstorePoultryInvoices).leftJoin(xstoreUsers, eq(xstorePoultryInvoices.cashierUserId, xstoreUsers.id)).where(and(eq(xstorePoultryInvoices.customerId, customer.id), eq(xstorePoultryInvoices.tenantId, user.tenantId))).orderBy(xstorePoultryInvoices.createdAt);
  const allPayments = await db.select({ payment: xstorePoultryPayments, cashierName: xstoreUsers.name }).from(xstorePoultryPayments).leftJoin(xstoreUsers, eq(xstorePoultryPayments.cashierUserId, xstoreUsers.id)).where(and(eq(xstorePoultryPayments.customerId, customer.id), eq(xstorePoultryPayments.tenantId, user.tenantId))).orderBy(xstorePoultryPayments.createdAt);
  const beforeSales = allInvoices.filter(x => x.invoice.createdAt < from).reduce((s,x)=>s+toNumber(x.invoice.total),0);
  const beforePaid = allInvoices.filter(x => x.invoice.createdAt < from).reduce((s,x)=>s+toNumber(x.invoice.amountPaid),0) + allPayments.filter(x => x.payment.createdAt < from).reduce((s,x)=>s+toNumber(x.payment.amount),0);
  const invoices = allInvoices.filter(x => x.invoice.createdAt >= from && x.invoice.createdAt <= to);
  const payments = allPayments.filter(x => x.payment.createdAt >= from && x.payment.createdAt <= to);
  const invoiceIds = invoices.map(x => x.invoice.id);
  const items = invoiceIds.length ? await db.select().from(xstorePoultryInvoiceItems).where(inArray(xstorePoultryInvoiceItems.invoiceId, invoiceIds)) : [];
  const rows = [
    ...invoices.map(({invoice,cashierName}) => {
      const invoiceItems = items.filter(item=>item.invoiceId===invoice.id);
      const netTotal = roundMoney(invoiceItems.reduce((sum,item)=>sum + toNumber(item.total), 0));
      return { type:"invoice", id:invoice.id, invoiceNo:invoice.invoiceNo, date:iso(invoice.createdAt), actorName:cashierName || "—", total:netTotal, paid:toNumber(invoice.amountPaid), note:null, items:invoiceItems.map(item=>({productName:item.productName,quantityKg:toNumber(item.quantityKg),unitPrice:toNumber(item.unitPrice),total:toNumber(item.total),deadWeightKg:toNumber(item.deadWeightKg),deadTotal:toNumber(item.deadTotal)})) };
    }),
    ...payments.map(({payment,cashierName}) => ({ type:"payment", id:payment.id, invoiceNo:null, date:iso(payment.createdAt), actorName:cashierName || "—", total:0, paid:toNumber(payment.amount), note:payment.note, items:[] })),
  ].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  const periodSales = rows.filter(row=>row.type==="invoice").reduce((s,row)=>s+row.total,0);
  const periodPaid = invoices.reduce((s,x)=>s+toNumber(x.invoice.amountPaid),0) + payments.reduce((s,x)=>s+toNumber(x.payment.amount),0);
  const totalKg = items.reduce((s,x)=>s+toNumber(x.quantityKg),0);
  res.json({ customer:{...customer,createdAt:iso(customer.createdAt),updatedAt:iso(customer.updatedAt)}, from:req.query.from||null, to:req.query.to||null, openingBalance:roundMoney(beforeSales-beforePaid), summary:{totalKg,sales:periodSales,paid:periodPaid,remaining:roundMoney(beforeSales-beforePaid+periodSales-periodPaid)}, rows });
});

router.get("/xstore/poultry/invoices", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, poultryUserRoles)) { res.status(403).json({ error: "ليس لديك صلاحية لعرض الفواتير." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from + "T00:00:00+02:00") : null;
  const to = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to + "T23:59:59.999+02:00") : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) { res.status(400).json({ error: "الفترة الزمنية غير صحيحة." }); return; }
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const invoiceRows = await db.select({
    invoice: xstorePoultryInvoices,
    customerName: xstoreCustomers.name,
    shopName: xstoreCustomers.shopName,
    phone: xstoreCustomers.phone,
    cashierName: xstoreUsers.name,
  })
    .from(xstorePoultryInvoices)
    .innerJoin(xstoreCustomers, eq(xstorePoultryInvoices.customerId, xstoreCustomers.id))
    .innerJoin(xstoreUsers, eq(xstorePoultryInvoices.cashierUserId, xstoreUsers.id))
    .where(eq(xstorePoultryInvoices.tenantId, user.tenantId))
    .orderBy(desc(xstorePoultryInvoices.createdAt));
  const payments = await db.select().from(xstorePoultryPayments).where(eq(xstorePoultryPayments.tenantId, user.tenantId));
  const invoiceRowsFiltered = invoiceRows.filter(row => {
    const date = row.invoice.createdAt.getTime();
    const matchesDate = (!from || date >= from.getTime()) && (!to || date <= to.getTime());
    const haystack = [row.invoice.invoiceNo, row.customerName, row.shopName || "", row.phone].join(" ").toLowerCase();
    return matchesDate && (!search || haystack.includes(search));
  });
  const invoiceIds = invoiceRowsFiltered.map(row => row.invoice.id);
  const items = invoiceIds.length ? await db.select().from(xstorePoultryInvoiceItems).where(inArray(xstorePoultryInvoiceItems.invoiceId, invoiceIds)) : [];
  const invoices = invoiceRowsFiltered.map(row => {
    const invoiceItems = items.filter(item => item.invoiceId === row.invoice.id).map(item => ({
      productName: item.productName,
      quantityKg: toNumber(item.quantityKg),
      unitPrice: toNumber(item.unitPrice),
      total: toNumber(item.total),
      deadWeightKg: toNumber(item.deadWeightKg),
      deadTotal: toNumber(item.deadTotal),
    }));
    const total = roundMoney(invoiceItems.reduce((sum,item)=>sum + toNumber(item.total), 0));
    const amountPaid = toNumber(row.invoice.amountPaid);
    const extraCollection = payments
      .filter(payment => payment.note?.includes(row.invoice.invoiceNo))
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    return {
      id: row.invoice.id,
      invoiceNo: row.invoice.invoiceNo,
      date: iso(row.invoice.createdAt),
      customerId: row.invoice.customerId,
      customerName: row.customerName,
      shopName: row.shopName,
      phone: row.phone,
      cashierName: row.cashierName,
      total,
      amountPaid,
      balance: roundMoney(total - amountPaid),
      amountReceived: roundMoney(amountPaid + extraCollection),
      extraCollection,
      items: invoiceItems,
    };
  });
  const paidFromExtra = invoices.reduce((sum, row) => sum + row.extraCollection, 0);
  res.json({
    invoices,
    summary: {
      count: invoices.length,
      sales: invoices.reduce((sum, row) => sum + row.total, 0),
      paid: roundMoney(invoices.reduce((sum, row) => sum + row.amountPaid, 0) + paidFromExtra),
      outstanding: roundMoney(invoices.reduce((sum, row) => sum + row.balance, 0)),
      totalKg: invoices.reduce((sum, row) => sum + row.items.reduce((s, item) => s + item.quantityKg, 0), 0),
    },
  });
});

router.post("/xstore/poultry/customers/:customerId/invoices", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "cashier", "retail_sales"])) { res.status(403).json({ error: "ليس لديك صلاحية إنشاء فاتورة دواجن." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const [customer] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id, req.params.customerId), eq(xstoreCustomers.tenantId, user.tenantId))).limit(1);
  if (!customer) { res.status(404).json({ error: "العميل غير موجود." }); return; }

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const items = rawItems
    .map((item:any)=>({
      productName:typeof item?.productName==="string"?item.productName.trim():"",
      quantityKg:Number(item?.quantityKg),
      unitPrice:Number(item?.unitPrice),
      deadWeightKg:Number(item?.deadWeightKg || 0),
    }))
    .filter((item:any)=>item.productName && Number.isFinite(item.quantityKg) && item.quantityKg>0 && Number.isFinite(item.unitPrice) && item.unitPrice>=0 && Number.isFinite(item.deadWeightKg) && item.deadWeightKg>=0);

  if (!items.length) {
    res.status(400).json({ error: "أضف صنفًا واحدًا على الأقل بالوزن وسعر الكيلو." });
    return;
  }
  if (items.some((item:any)=>item.deadWeightKg > item.quantityKg)) {
    res.status(400).json({ error: "وزن النافق لا يمكن أن يكون أكبر من وزن البيع." });
    return;
  }

  const total = roundMoney(items.reduce((s:number,item:any)=>s+Math.max(0,roundMoney(item.quantityKg*item.unitPrice)-roundMoney(item.deadWeightKg*item.unitPrice)),0));
  const amountReceived = Number(req.body?.amountPaid);
  if (!Number.isFinite(amountReceived) || amountReceived < 0) {
    res.status(400).json({ error: "أدخل المبلغ المدفوع اليوم بشكل صحيح." });
    return;
  }

  const existingInvoices = await db.select({ total: xstorePoultryInvoices.total, amountPaid: xstorePoultryInvoices.amountPaid })
    .from(xstorePoultryInvoices)
    .where(and(eq(xstorePoultryInvoices.customerId, customer.id), eq(xstorePoultryInvoices.tenantId, user.tenantId)));
  const existingPayments = await db.select({ amount: xstorePoultryPayments.amount })
    .from(xstorePoultryPayments)
    .where(and(eq(xstorePoultryPayments.customerId, customer.id), eq(xstorePoultryPayments.tenantId, user.tenantId)));
  const existingBalance = roundMoney(
    existingInvoices.reduce((sum, row) => sum + toNumber(row.total) - toNumber(row.amountPaid), 0)
    - existingPayments.reduce((sum, row) => sum + toNumber(row.amount), 0),
  );
  const maxReceivableToday = roundMoney(total + Math.max(0, existingBalance));
  if (amountReceived > maxReceivableToday) {
    res.status(400).json({
      error: "المبلغ المدفوع اليوم أكبر من إجمالي الفاتورة ورصيد العميل المستحق.",
    });
    return;
  }

  const amountPaid = Math.min(total, amountReceived);
  const extraCollection = roundMoney(Math.max(0, amountReceived - total));
  const invoiceNo = "PD-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + Math.random().toString(36).slice(2,7).toUpperCase();

  const invoice = await db.transaction(async tx => {
    const [created] = await tx.insert(xstorePoultryInvoices).values({
      tenantId:user.tenantId!,
      customerId:customer.id,
      cashierUserId:user.id,
      invoiceNo,
      total:String(total),
      amountPaid:String(amountPaid),
    }).returning();

    if (!created) throw new DomainError("تعذر إنشاء الفاتورة.",500);

    for (const item of items) {
      await consumeFarmStock(tx,user.tenantId!,item.productName,roundMoney(item.quantityKg),created.id,user.id);
      await tx.insert(xstorePoultryInvoiceItems).values({invoiceId:created.id,productName:item.productName,quantityKg:String(item.quantityKg),unitPrice:String(item.unitPrice),total:String(Math.max(0,roundMoney(item.quantityKg*item.unitPrice)-roundMoney(item.deadWeightKg*item.unitPrice))),deadWeightKg:String(item.deadWeightKg),deadTotal:String(roundMoney(item.deadWeightKg*item.unitPrice))});
    }

    if (extraCollection > 0) {
      await tx.insert(xstorePoultryPayments).values({
        tenantId:user.tenantId!,
        customerId:customer.id,
        cashierUserId:user.id,
        amount:String(extraCollection),
        note:"تحصيل من الرصيد السابق مع الفاتورة "+invoiceNo,
      });
    }

    return created;
  });

  await audit(
    user,
    "poultry.invoice_created",
    user.tenantId,
    "poultry_invoice",
    invoice.id,
    "تم تسجيل فاتورة "+invoiceNo+" للعميل "+customer.name+" بقيمة "+total,
  );

  if (extraCollection > 0) {
    await audit(
      user,
      "poultry.payment_collected",
      user.tenantId,
      "poultry_payment",
      invoice.id,
      "تم تحصيل "+extraCollection+" من الرصيد السابق للعميل "+customer.name+" مع الفاتورة "+invoiceNo,
    );
  }

  res.status(201).json({
    id:invoice.id,
    invoiceNo,
    total,
    deadWeightKg:roundMoney(items.reduce((sum:number,item:any)=>sum+item.deadWeightKg,0)),
    deadTotal:roundMoney(items.reduce((sum:number,item:any)=>sum+roundMoney(item.deadWeightKg*item.unitPrice),0)),
    amountPaid,
    extraCollection,
    amountReceived,
    balance:roundMoney(total-amountPaid),
    createdAt:iso(invoice.createdAt),
    cashierName:user.name,
  });
});
router.post("/xstore/poultry/customers/:customerId/payments", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin", "cashier", "collector"])) { res.status(403).json({ error: "ليس لديك صلاحية تسجيل تحصيل." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const [customer] = await db.select().from(xstoreCustomers).where(and(eq(xstoreCustomers.id,req.params.customerId),eq(xstoreCustomers.tenantId,user.tenantId))).limit(1);
  if (!customer) { res.status(404).json({ error: "العميل غير موجود." }); return; }
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount<=0) { res.status(400).json({ error: "أدخل مبلغ تحصيل صحيح." }); return; }
  const [payment] = await db.insert(xstorePoultryPayments).values({tenantId:user.tenantId,customerId:customer.id,cashierUserId:user.id,amount:String(roundMoney(amount)),note:typeof req.body?.note==="string"?req.body.note.trim()||null:null}).returning();
  if (!payment) { res.status(500).json({ error: "تعذر تسجيل التحصيل." }); return; }
  await audit(user,"poultry.payment_collected",user.tenantId,"poultry_payment",payment.id,"تم تحصيل "+roundMoney(amount)+" من العميل "+customer.name);
  res.status(201).json({id:payment.id,amount:roundMoney(amount),createdAt:iso(payment.createdAt),collectorName:user.name});
});

router.get("/xstore/poultry/reports/financial", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, poultryUserRoles)) { res.status(403).json({ error: "ليس لديك صلاحية لعرض التقرير المالي." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from + "T00:00:00+02:00") : new Date(new Date().toISOString().slice(0, 7) + "-01T00:00:00+02:00");
  const to = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to + "T23:59:59.999+02:00") : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) { res.status(400).json({ error: "الفترة الزمنية غير صحيحة." }); return; }
  try {
    const invoices = await db.select().from(xstorePoultryInvoices)
      .where(and(eq(xstorePoultryInvoices.tenantId, user.tenantId), sql`created_at >= ${from} and created_at <= ${to}`))
      .orderBy(desc(xstorePoultryInvoices.createdAt));
    const invoiceIds = invoices.map(row => row.id);
    const payments = await db.select().from(xstorePoultryPayments)
      .where(and(eq(xstorePoultryPayments.tenantId, user.tenantId), sql`created_at >= ${from} and created_at <= ${to}`));
    const items: Array<typeof xstorePoultryInvoiceItems.$inferSelect> = invoiceIds.length
      ? await db.select().from(xstorePoultryInvoiceItems).where(inArray(xstorePoultryInvoiceItems.invoiceId, invoiceIds))
      : [];
    const totalSales = roundMoney(invoices.reduce((sum, row) => sum + toNumber(row.total), 0));
    const totalCollected = roundMoney(invoices.reduce((sum, row) => sum + toNumber(row.amountPaid), 0) + payments.reduce((sum, row) => sum + toNumber(row.amount), 0));
    const totalKg = roundMoney(items.reduce((sum, row) => sum + toNumber(row.quantityKg), 0));
    const farmOut = invoiceIds.length ? await db.select().from(xstorePoultryFarmMovements).where(and(eq(xstorePoultryFarmMovements.tenantId,user.tenantId),inArray(xstorePoultryFarmMovements.invoiceId,invoiceIds),eq(xstorePoultryFarmMovements.movementType,"out"))) : [];
    const costOfGoodsSold = roundMoney(farmOut.reduce((sum,row)=>sum+toNumber(row.totalCost),0));
    const grossProfit = roundMoney(totalSales - costOfGoodsSold);
    const customerIds = new Set(invoices.map(row => row.customerId));
    res.json({
      from: typeof req.query.from === "string" ? req.query.from : from.toISOString().slice(0, 10),
      to: typeof req.query.to === "string" ? req.query.to : to.toISOString().slice(0, 10),
      invoiceCount: invoices.length,
      totalSales,
      totalCollected,
      outstanding: roundMoney(totalSales - totalCollected),
      totalKg,
      customerCount: customerIds.size,
      averageInvoice: invoices.length ? roundMoney(totalSales / invoices.length) : 0,
      costOfGoodsSold,
      grossProfit,
    });
  } catch (error) {
    req.log.error({ error }, "Unable to create poultry financial report");
    res.status(500).json({ error: "تعذر تحميل التقرير المالي للدواجن." });
  }
});

router.get("/xstore/poultry/notifications", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin"])) { res.status(403).json({error:"غير مصرح."}); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const [invoices,payments] = await Promise.all([
    db.select({invoice:xstorePoultryInvoices,customerName:xstoreCustomers.name,actorName:xstoreUsers.name}).from(xstorePoultryInvoices).innerJoin(xstoreCustomers,eq(xstorePoultryInvoices.customerId,xstoreCustomers.id)).innerJoin(xstoreUsers,eq(xstorePoultryInvoices.cashierUserId,xstoreUsers.id)).where(eq(xstorePoultryInvoices.tenantId,user.tenantId)).orderBy(desc(xstorePoultryInvoices.createdAt)).limit(20),
    db.select({payment:xstorePoultryPayments,customerName:xstoreCustomers.name,actorName:xstoreUsers.name}).from(xstorePoultryPayments).innerJoin(xstoreCustomers,eq(xstorePoultryPayments.customerId,xstoreCustomers.id)).innerJoin(xstoreUsers,eq(xstorePoultryPayments.cashierUserId,xstoreUsers.id)).where(eq(xstorePoultryPayments.tenantId,user.tenantId)).orderBy(desc(xstorePoultryPayments.createdAt)).limit(20),
  ]);
  res.json([...invoices.map(x=>({id:"poultry-invoice:"+x.invoice.id,type:"invoice",title:"تم تسجيل فاتورة دواجن",detail:x.customerName+" · "+toNumber(x.invoice.total)+" جنيه · بواسطة "+x.actorName,createdAt:iso(x.invoice.createdAt),href:"/poultry-sales"})),...payments.map(x=>({id:"poultry-payment:"+x.payment.id,type:"payment",title:"تم تسجيل تحصيل",detail:x.customerName+" · "+toNumber(x.payment.amount)+" جنيه · بواسطة "+x.actorName,createdAt:iso(x.payment.createdAt),href:"/poultry-collections"}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,40));
});



const POULTRY_BACKUP_MEDIA_TYPE = "application/vnd.xstore.poultry-backup+json";
const POULTRY_BACKUP_MAX_BYTES = 64 * 1024 * 1024;
const POULTRY_BACKUP_TABLES = ["xstoreCustomers","xstorePoultryInvoices","xstorePoultryInvoiceItems","xstorePoultryPayments","xstoreAuditLogs"] as const;

router.get("/xstore/poultry/backup", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin"])) { res.status(403).json({ error: "ليس لديك صلاحية إنشاء النسخة الاحتياطية." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  try {
    const [customers, invoices, items, payments, auditLogs] = await Promise.all([
      db.select().from(xstoreCustomers).where(eq(xstoreCustomers.tenantId, user.tenantId)),
      db.select().from(xstorePoultryInvoices).where(eq(xstorePoultryInvoices.tenantId, user.tenantId)),
      db.select().from(xstorePoultryInvoiceItems).where(sql`invoice_id in (select id from xstore_poultry_invoices where tenant_id = ${user.tenantId})`),
      db.select().from(xstorePoultryPayments).where(eq(xstorePoultryPayments.tenantId, user.tenantId)),
      db.select().from(xstoreAuditLogs).where(eq(xstoreAuditLogs.tenantId, user.tenantId)),
    ]);
    const backup = {
      format: "xstore-poultry-backup" as const, version: 1 as const, backupType: "full" as const,
      tenantId: user.tenantId, createdAt: new Date().toISOString(),
      tables: { xstoreCustomers: customers, xstorePoultryInvoices: invoices, xstorePoultryInvoiceItems: items, xstorePoultryPayments: payments, xstoreAuditLogs: auditLogs },
      counts: { xstoreCustomers: customers.length, xstorePoultryInvoices: invoices.length, xstorePoultryInvoiceItems: items.length, xstorePoultryPayments: payments.length, xstoreAuditLogs: auditLogs.length },
    };
    if (Buffer.byteLength(JSON.stringify(backup), "utf8") > POULTRY_BACKUP_MAX_BYTES) {
      res.status(413).json({ error: "حجم نسخة الدواجن أكبر من الحد المسموح به وهو 64 ميبيبايت." }); return;
    }
    res.setHeader("Content-Type", POULTRY_BACKUP_MEDIA_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="x-store-poultry-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json(backup);
  } catch (error) {
    req.log.error({ error }, "Unable to create poultry backup");
    res.status(500).json({ error: "تعذر إنشاء نسخة الدواجن الاحتياطية." });
  }
});

function validatePoultryBackup(value: any, tenantId: string): asserts value is {
  format: "xstore-poultry-backup"; version: 1; backupType: "full"; tenantId: string; createdAt: string;
  tables: Record<(typeof POULTRY_BACKUP_TABLES)[number], unknown[]>;
} {
  if (!value || value.format !== "xstore-poultry-backup" || value.version !== 1 || value.backupType !== "full" ||
      value.tenantId !== tenantId || typeof value.createdAt !== "string" || !value.tables || typeof value.tables !== "object") {
    throw new Error("ملف نسخة الدواجن غير صالح أو يخص متجرًا آخر.");
  }
  for (const table of POULTRY_BACKUP_TABLES) {
    if (!Array.isArray(value.tables[table])) throw new Error("النسخة غير مكتملة وتفتقد بعض بيانات الدواجن.");
  }
}

router.post("/xstore/poultry/backup/restore", async (req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user, ["tenant_admin"])) { res.status(403).json({ error: "ليس لديك صلاحية استعادة النسخة الاحتياطية." }); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  try {
    validatePoultryBackup(req.body, user.tenantId);
    const { tables } = req.body;
    await db.transaction(async tx => {
      await tx.delete(xstorePoultryPayments).where(eq(xstorePoultryPayments.tenantId, user.tenantId!));
      const invoiceIds = await tx.select({ id: xstorePoultryInvoices.id }).from(xstorePoultryInvoices).where(eq(xstorePoultryInvoices.tenantId, user.tenantId!));
      if (invoiceIds.length) await tx.delete(xstorePoultryInvoiceItems).where(inArray(xstorePoultryInvoiceItems.invoiceId, invoiceIds.map(row => row.id)));
      await tx.delete(xstorePoultryInvoices).where(eq(xstorePoultryInvoices.tenantId, user.tenantId!));
      await tx.delete(xstoreCustomers).where(eq(xstoreCustomers.tenantId, user.tenantId!));
      await tx.delete(xstoreAuditLogs).where(eq(xstoreAuditLogs.tenantId, user.tenantId!));
      if (tables.xstoreCustomers.length) await tx.insert(xstoreCustomers).values(tables.xstoreCustomers as any);
      if (tables.xstorePoultryInvoices.length) await tx.insert(xstorePoultryInvoices).values(tables.xstorePoultryInvoices as any);
      if (tables.xstorePoultryInvoiceItems.length) await tx.insert(xstorePoultryInvoiceItems).values(tables.xstorePoultryInvoiceItems as any);
      if (tables.xstorePoultryPayments.length) await tx.insert(xstorePoultryPayments).values(tables.xstorePoultryPayments as any);
      if (tables.xstoreAuditLogs.length) await tx.insert(xstoreAuditLogs).values(tables.xstoreAuditLogs as any);
    });
    res.json({ restored: true, backupType: "full" });
  } catch (error) {
    req.log.error({ error }, "Unable to restore poultry backup");
    res.status(400).json({ error: error instanceof Error ? error.message : "تعذرت استعادة نسخة الدواجن." });
  }
});

export default router;
