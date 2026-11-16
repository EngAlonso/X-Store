import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  db, xstoreAuditLogs, xstoreCustomers, xstorePoultryInvoices,
  xstorePoultryInvoiceItems, xstorePoultryPayments, xstoreTenants, xstoreUsers,
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
  if (!name || !phone) { res.status(400).json({ error: "اسم العميل ورقم الهاتف مطلوبان." }); return; }
  const [customer] = await db.insert(xstoreCustomers).values({ tenantId: user.tenantId, name, phone, shopName: shopName || null, shopAddress: shopAddress || null }).returning();
  if (!customer) { res.status(500).json({ error: "تعذر إنشاء العميل." }); return; }
  try {
    await audit(user, "poultry.customer_created", user.tenantId, "poultry_customer", customer.id, "تم إضافة العميل " + name);
  } catch (error) {
    console.error("Poultry customer audit failed after successful customer creation:", error);
  }
  res.status(201).json({ ...customer, createdAt: iso(customer.createdAt), updatedAt: iso(customer.updatedAt) });
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
  const allInvoices = await db.select({ invoice: xstorePoultryInvoices, cashierName: xstoreUsers.name }).from(xstorePoultryInvoices).innerJoin(xstoreUsers, eq(xstorePoultryInvoices.cashierUserId, xstoreUsers.id)).where(and(eq(xstorePoultryInvoices.customerId, customer.id), eq(xstorePoultryInvoices.tenantId, user.tenantId))).orderBy(xstorePoultryInvoices.createdAt);
  const allPayments = await db.select({ payment: xstorePoultryPayments, cashierName: xstoreUsers.name }).from(xstorePoultryPayments).innerJoin(xstoreUsers, eq(xstorePoultryPayments.cashierUserId, xstoreUsers.id)).where(and(eq(xstorePoultryPayments.customerId, customer.id), eq(xstorePoultryPayments.tenantId, user.tenantId))).orderBy(xstorePoultryPayments.createdAt);
  const beforeSales = allInvoices.filter(x => x.invoice.createdAt < from).reduce((s,x)=>s+toNumber(x.invoice.total),0);
  const beforePaid = allInvoices.filter(x => x.invoice.createdAt < from).reduce((s,x)=>s+toNumber(x.invoice.amountPaid),0) + allPayments.filter(x => x.payment.createdAt < from).reduce((s,x)=>s+toNumber(x.payment.amount),0);
  const invoices = allInvoices.filter(x => x.invoice.createdAt >= from && x.invoice.createdAt <= to);
  const payments = allPayments.filter(x => x.payment.createdAt >= from && x.payment.createdAt <= to);
  const invoiceIds = invoices.map(x => x.invoice.id);
  const items = invoiceIds.length ? await db.select().from(xstorePoultryInvoiceItems).where(inArray(xstorePoultryInvoiceItems.invoiceId, invoiceIds)) : [];
  const rows = [
    ...invoices.map(({invoice,cashierName}) => ({ type:"invoice", id:invoice.id, invoiceNo:invoice.invoiceNo, date:iso(invoice.createdAt), actorName:cashierName, total:toNumber(invoice.total), paid:toNumber(invoice.amountPaid), note:null, items:items.filter(item=>item.invoiceId===invoice.id).map(item=>({productName:item.productName,quantityKg:toNumber(item.quantityKg),unitPrice:toNumber(item.unitPrice),total:toNumber(item.total)})) })),
    ...payments.map(({payment,cashierName}) => ({ type:"payment", id:payment.id, invoiceNo:null, date:iso(payment.createdAt), actorName:cashierName, total:0, paid:toNumber(payment.amount), note:payment.note, items:[] })),
  ].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
  const periodSales = invoices.reduce((s,x)=>s+toNumber(x.invoice.total),0);
  const periodPaid = invoices.reduce((s,x)=>s+toNumber(x.invoice.amountPaid),0) + payments.reduce((s,x)=>s+toNumber(x.payment.amount),0);
  const totalKg = items.reduce((s,x)=>s+toNumber(x.quantityKg),0);
  res.json({ customer:{...customer,createdAt:iso(customer.createdAt),updatedAt:iso(customer.updatedAt)}, from:req.query.from||null, to:req.query.to||null, openingBalance:roundMoney(beforeSales-beforePaid), summary:{totalKg,sales:periodSales,paid:periodPaid,remaining:roundMoney(beforeSales-beforePaid+periodSales-periodPaid)}, rows });
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
    }))
    .filter((item:any)=>item.productName && Number.isFinite(item.quantityKg) && item.quantityKg>0 && Number.isFinite(item.unitPrice) && item.unitPrice>=0);

  if (!items.length) {
    res.status(400).json({ error: "أضف صنفًا واحدًا على الأقل بالوزن وسعر الكيلو." });
    return;
  }

  const total = roundMoney(items.reduce((s:number,item:any)=>s+roundMoney(item.quantityKg*item.unitPrice),0));
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

    await tx.insert(xstorePoultryInvoiceItems).values(
      items.map((item:any)=>({
        invoiceId:created.id,
        productName:item.productName,
        quantityKg:String(item.quantityKg),
        unitPrice:String(item.unitPrice),
        total:String(roundMoney(item.quantityKg*item.unitPrice)),
      })),
    );

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
  await audit(user,"poultry.payment_collected",user.tenantId,payment.id,"poultry_payment",payment.id,"تم تحصيل "+roundMoney(amount)+" من العميل "+customer.name);
  res.status(201).json({id:payment.id,amount:roundMoney(amount),createdAt:iso(payment.createdAt),collectorName:user.name});
});

router.get("/xstore/poultry/notifications", async (_req, res): Promise<void> => {
  const user = getXStoreUser(res);
  if (!user.tenantId || !hasRole(user,poultryUserRoles)) { res.status(403).json({error:"غير مصرح."}); return; }
  if (!(await ensurePoultryTenantAccess(user, res))) return;
  const [invoices,payments] = await Promise.all([
    db.select({invoice:xstorePoultryInvoices,customerName:xstoreCustomers.name,actorName:xstoreUsers.name}).from(xstorePoultryInvoices).innerJoin(xstoreCustomers,eq(xstorePoultryInvoices.customerId,xstoreCustomers.id)).innerJoin(xstoreUsers,eq(xstorePoultryInvoices.cashierUserId,xstoreUsers.id)).where(eq(xstorePoultryInvoices.tenantId,user.tenantId)).orderBy(desc(xstorePoultryInvoices.createdAt)).limit(20),
    db.select({payment:xstorePoultryPayments,customerName:xstoreCustomers.name,actorName:xstoreUsers.name}).from(xstorePoultryPayments).innerJoin(xstoreCustomers,eq(xstorePoultryPayments.customerId,xstoreCustomers.id)).innerJoin(xstoreUsers,eq(xstorePoultryPayments.cashierUserId,xstoreUsers.id)).where(eq(xstorePoultryPayments.tenantId,user.tenantId)).orderBy(desc(xstorePoultryPayments.createdAt)).limit(20),
  ]);
  res.json([...invoices.map(x=>({id:"poultry-invoice:"+x.invoice.id,type:"invoice",title:"تم تسجيل فاتورة دواجن",detail:x.customerName+" · "+toNumber(x.invoice.total)+" جنيه · بواسطة "+x.actorName,createdAt:iso(x.invoice.createdAt),href:"/poultry-sales"})),...payments.map(x=>({id:"poultry-payment:"+x.payment.id,type:"payment",title:"تم تسجيل تحصيل",detail:x.customerName+" · "+toNumber(x.payment.amount)+" جنيه · بواسطة "+x.actorName,createdAt:iso(x.payment.createdAt),href:"/poultry-collections"}))].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,40));
});


export default router;
