import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  AlertTriangle, ArrowLeft, Bird, Boxes, ChevronLeft, CircleCheck, CreditCard,
  Calculator, Download, MessageCircle, Plus, Share2, Printer, ReceiptText, Search, ShieldCheck, Users, Wallet, RefreshCw, Pencil as PencilIcon,
} from 'lucide-react';
import type { SessionUser } from '@workspace/api-client-react';
import './poultry.css';
import { APP_EGYPT_DATE_LOCALE, APP_NUMBER_LOCALE } from '../../lib/formatting';
import { poultryApi, type PoultryCustomer, type PoultryInvoiceResult, type PoultryStatement } from './poultryApi';

const fmt = (value: number) => new Intl.NumberFormat(APP_NUMBER_LOCALE, { maximumFractionDigits: 2 }).format(Number(value) || 0);
const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
const dateLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(date) : '—';
};
function hasAppRole(user: SessionUser | null | undefined, roles: readonly string[]): boolean {
  if (!user) return false;
  if (roles.includes(user.role)) return true;
  if (user.role !== 'custom') return false;
  const permissions = user.permissions || [];
  return permissions.some(permission => roles.includes(permission)) ||
    (roles.includes('cashier') && permissions.some(permission => permission === 'retail_sales' || permission === 'wholesale_sales'));
}
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function SectionHead({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="section-head"><div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>{action}</div>;
}
function StatCard({ label, value, detail, icon: Icon, tint = 'green' }: { label: string; value: string; detail: string; icon: any; tint?: string }) {
  return <div className="stat-card"><div className={`stat-icon tint-${tint}`}><Icon size={19}/></div><span className="stat-label">{label}</span><b className="stat-value">{value}</b><small>{detail}</small></div>;
}
function PageTitle({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{action && <div className="page-action">{action}</div>}</div>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="إغلاق">×</button></div>{children}</section></div>;
}


type PoultryInvoiceSettings = NonNullable<SessionUser['invoiceSettings']>;
const defaultPoultryInvoiceSettings: PoultryInvoiceSettings = {
  showCustomer: true, showShop: true, showPhone: true, showCashier: true,
  showProduct: true, showQuantity: true, showUnitPrice: true, showDeadWeight: true,
  showTotal: true, showPaid: true, showExtraCollection: true, showBalance: true,
  showDateTime: true, showHeader: true, headerStoreName: '', headerOwnerName: '',
  headerMessage: '', headerPhones: '',
};
function invoiceSettingsOrDefault(settings?: PoultryInvoiceSettings|null): PoultryInvoiceSettings { return {...defaultPoultryInvoiceSettings,...(settings||{})}; }
function customerStatementInvoiceSettings(settings?: PoultryInvoiceSettings|null): PoultryInvoiceSettings {
  const s=invoiceSettingsOrDefault(settings);
  return {...s,showHeader:true};
}

function PoultryInvoiceHeader({settings}:{settings?:PoultryInvoiceSettings|null}) {
  const s=invoiceSettingsOrDefault(settings);
  const lines=[s.headerStoreName,s.headerOwnerName,s.headerMessage,s.headerPhones].filter(line=>String(line||'').trim());
  if(!s.showHeader||!lines.length)return null;
  return <div dir="rtl" className="poultry-invoice-store-header" style={{display:'grid',gridTemplateColumns:'34px minmax(0,1fr) 34px',alignItems:'center',gap:8,padding:'12px 10px',marginBottom:10,borderRadius:13,background:'#173f2b',color:'#fff',textAlign:'center'}}>
    <span aria-hidden="true" style={{fontSize:27,lineHeight:1}}>🐔</span>
    <div style={{display:'grid',gap:3,minWidth:0}}>
      {lines.map((line,i)=><b key={i} style={{fontSize:i===0?19:i===1?16:13,lineHeight:1.45,overflowWrap:'anywhere'}}>{line}</b>)}
    </div>
    <span aria-hidden="true" style={{fontSize:27,lineHeight:1}}>🐔</span>
  </div>;
}

function buildUnifiedInvoiceMarkup(invoice:any,customer:any,details:any,settings?:PoultryInvoiceSettings){
  const s=invoiceSettingsOrDefault(settings),items=Array.isArray(invoice.items)&&invoice.items.length?invoice.items:[details||{}],d=new Date(invoice.createdAt||invoice.date),dateText=new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Cairo'}).format(d),timeText=new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(d);
  const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const field=(label:string,value:any)=>'<div class="meta"><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b></div>';
  const headerLines=s.showHeader?[s.headerStoreName,s.headerOwnerName,s.headerMessage,s.headerPhones].filter(x=>String(x||'').trim()):[];
  const header=headerLines.length?'<header class="store-head"><span>🐔</span><div>'+headerLines.map((line,i)=>'<b class="line line-'+i+'">'+esc(line)+'</b>').join('')+'</div><span>🐔</span></header>':'';
  const meta=[s.showCustomer?field('الاسم',customer?.name||invoice.customerName):'',s.showShop?field('المحل',customer?.shopName||invoice.shopName||'غير مسجل'):'',s.showPhone?field('الهاتف',customer?.phone||invoice.phone||'—'):'',s.showDateTime?field('اليوم والتاريخ',dateText):'',s.showDateTime?field('الوقت',timeText):'',s.showCashier?field('الموظف',invoice.cashierName||'غير محدد'):''].filter(Boolean).join('');
  const saleCount=[s.showProduct,s.showQuantity,s.showUnitPrice,s.showDeadWeight,s.showTotal].filter(Boolean).length;
  const itemCards=saleCount?items.map((item:any)=>'<div class="sale-item">'+(s.showProduct?'<div><small>الصنف</small><b>'+esc(item.productName||'فراخ')+'</b></div>':'')+(s.showQuantity?'<div><small>الوزن</small><b>'+esc(fmt(Number(item.quantityKg)||0)+' كجم')+'</b></div>':'')+(s.showUnitPrice?'<div><small>سعر الكيلو</small><b>'+esc(fmt(Number(item.unitPrice)||0)+' ج.م')+'</b></div>':'')+(s.showDeadWeight?'<div><small>نافِق</small><b>'+esc(fmt(Number(item.deadWeightKg)||0)+' كجم · '+fmt(Number(item.deadTotal)||0)+' ج.م')+'</b></div>':'')+(s.showTotal?'<div class="sale-total"><small>إجمالي البيع</small><strong>'+esc(fmt(Number(item.total)||0)+' ج.م')+'</strong></div>':'')+'</div>').join(''):'';
  const totals=[s.showPaid?'<div><small>المدفوع</small><b>'+esc(fmt(Number(invoice.amountPaid)||0)+' ج.م')+'</b></div>':'',s.showExtraCollection?'<div><small>التحصيل من الرصيد السابق</small><b>'+esc(fmt(Number(invoice.extraCollection)||0)+' ج.م')+'</b></div>':'',s.showBalance?'<div class="remaining"><small>المتبقي</small><strong>'+esc(fmt(Number(invoice.balance)||0)+' ج.م')+'</strong></div>':''].filter(Boolean).join('');
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#202522;font-family:Arial,Tahoma,sans-serif;direction:rtl}.receipt{width:100%;padding:22px;background:#fff}.store-head{display:grid;grid-template-columns:54px minmax(0,1fr) 54px;align-items:center;gap:12px;min-height:170px;padding:22px 18px;margin-bottom:18px;border-radius:24px;background:#173f2b;color:#fff;text-align:center}.store-head>span{font-size:44px}.store-head>div{display:grid;gap:4px;min-width:0}.store-head b{display:block;overflow-wrap:anywhere;line-height:1.45}.line-0{font-size:34px}.line-1{font-size:28px}.line-2,.line-3{font-size:22px}.invoice-top{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border:1px solid #dfe7e1;border-radius:22px;margin-bottom:8px}.invoice-top small{display:block;font-size:22px;font-weight:800}.invoice-top h1{margin:10px 0 0;font-size:30px;font-weight:500;color:#244a35}.invoice-top .receipt-icon{font-size:48px}.meta-wrap{padding:16px;border:1px solid #dfe7e1;border-radius:22px;margin-bottom:8px}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.meta{min-height:86px;padding:12px 15px;border:1px solid #e0e5e1;border-radius:20px;display:flex;flex-direction:column;justify-content:center;gap:7px;min-width:0}.meta small,.sale-item small,.totals small{font-size:16px;color:#78847d}.meta b{font-size:21px;overflow-wrap:anywhere}.sale-wrap{padding:18px;border:1px solid #dfe7e1;border-radius:22px;margin-bottom:8px}.section-title{font-size:17px;color:#718078;font-weight:800;margin-bottom:12px}.sale-item{display:grid;gap:10px;padding:16px;border:1px solid #e0e5e1;border-radius:20px;margin-bottom:8px}.sale-item>div{display:flex;flex-direction:column;gap:5px}.sale-item b,.sale-item strong{font-size:21px}.sale-total{background:#edf5ee;padding:10px 14px;border-radius:10px}.totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.totals>div{min-width:0;padding:14px 10px;border-radius:18px;text-align:right}.totals small{display:block;margin-bottom:8px}.totals b,.totals strong{font-size:21px;overflow-wrap:anywhere}.totals>div:not(.remaining){background:#fff;border:1px solid #e0e5e1}.totals .remaining{background:#edf5ee;color:#24553b}.foot{text-align:center;color:#718078;font-size:13px;margin-top:16px}</style></head><body><main class="receipt">'+header+'<section class="invoice-top"><div><small>تم الحفظ بنجاح</small><h1>فاتورة '+esc(invoice.invoiceNo)+'</h1></div><span class="receipt-icon">▤</span></section>'+(meta?'<section class="meta-wrap"><div class="meta-grid">'+meta+'</div></section>':'')+(itemCards?'<section class="sale-wrap"><div class="section-title">تفاصيل البيع</div>'+itemCards+'</section>':'')+(totals?'<section class="totals">'+totals+'</section>':'')+'<div class="foot">تم استخراج الفاتورة من نظام X-Store</div></main></body></html>';
}
async function buildUnifiedInvoiceImageBlob(invoice:any,customer:any,details:any,settings?:PoultryInvoiceSettings): Promise<Blob|null>{
  const markup=buildUnifiedInvoiceMarkup(invoice,customer,details,settings),width=760,s=invoiceSettingsOrDefault(settings),items=Array.isArray(invoice.items)&&invoice.items.length?invoice.items:[details||{}],metaCount=[s.showCustomer,s.showShop,s.showPhone,s.showDateTime,s.showCashier].filter(Boolean).length,saleCount=[s.showProduct,s.showQuantity,s.showUnitPrice,s.showDeadWeight,s.showTotal].filter(Boolean).length,totalCount=[s.showPaid,s.showExtraCollection,s.showBalance].filter(Boolean).length,headerCount=s.showHeader?[s.headerStoreName,s.headerOwnerName,s.headerMessage,s.headerPhones].filter(x=>String(x||'').trim()).length:0,height=100+(headerCount?190:0)+130+(metaCount?55+Math.ceil(metaCount/2)*106:0)+(saleCount?100+items.length*(saleCount*58+50):0)+(totalCount?130:0)+65;
  const style=(markup.match(/<style>([\s\S]*?)<\/style>/i)||[])[1]||"",body=(markup.match(/<body[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||"";
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><foreignObject width="'+width+'" height="'+height+'"><div xmlns="http://www.w3.org/1999/xhtml" style="width:'+width+'px;height:'+height+'px;overflow:hidden"><style>'+style+'</style>'+body+'</div></foreignObject></svg>';
  return await new Promise(resolve=>{const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})),image=new Image();image.onload=()=>{const scale=2,canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(url);resolve(null);return;}ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(scale,scale);ctx.drawImage(image,0,0,width,height);canvas.toBlob(file=>{URL.revokeObjectURL(url);resolve(file)},'image/jpeg',0.94)};image.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
}
async function drawUnifiedInvoiceImage(invoice:any,customer:any,details:any,filename:string,settings?:PoultryInvoiceSettings){const file=await buildUnifiedInvoiceImageBlob(invoice,customer,details,settings);if(!file)return;const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function shareUnifiedInvoiceImage(invoice:any,customer:any,details:any,settings?:PoultryInvoiceSettings){const file=await buildUnifiedInvoiceImageBlob(invoice,customer,details,settings);if(!file)return;const imageFile=new File([file],'فاتورة-'+String(invoice.invoiceNo||'invoice')+'.jpg',{type:'image/jpeg'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[imageFile]}))){await navigator.share({files:[imageFile],title:'فاتورة '+String(invoice.invoiceNo||''),text:'فاتورة '+String(invoice.invoiceNo||'')});return}}catch(e:any){if(e?.name==='AbortError')return}const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=imageFile.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}

function buildUnifiedInvoicePrint(invoice:any,customer:any,details:any,settings?:PoultryInvoiceSettings){
  const popup=window.open('','_blank','width=900,height=1000');if(!popup)return;
  popup.document.open();popup.document.write(buildUnifiedInvoiceMarkup(invoice,customer,details,settings).replace('</head>','<style>@page{size:A5 portrait;margin:0}html,body{width:148mm;min-height:210mm;margin:0;padding:0}@media print{html,body{width:148mm;height:210mm;min-height:210mm;max-height:210mm;overflow:hidden}.receipt{box-sizing:border-box;width:205.56mm;height:291.67mm;min-height:291.67mm;max-height:291.67mm;overflow:visible;padding:6.94mm;margin:0;zoom:.72;break-inside:avoid;break-after:avoid;page-break-inside:avoid;page-break-after:avoid}.store-head{min-height:0;padding:10px 8px;margin-bottom:8px}.store-head>span{font-size:30px}.line-0{font-size:24px}.line-1{font-size:20px}.line-2,.line-3{font-size:15px}.invoice-top{padding:10px 12px;margin-bottom:5px}.invoice-top small{font-size:16px}.invoice-top h1{font-size:22px;margin:5px 0 0}.invoice-top .receipt-icon{font-size:34px}.meta-wrap{padding:8px;margin-bottom:5px}.meta-grid{gap:5px}.meta{min-height:54px;padding:7px 9px;border-radius:12px;gap:3px}.meta small,.sale-item small,.totals small{font-size:11px}.meta b{font-size:14px}.sale-wrap{padding:9px;margin-bottom:5px}.section-title{font-size:12px;margin-bottom:6px}.sale-item{gap:5px;padding:8px;border-radius:12px;margin-bottom:4px}.sale-item>div{gap:2px}.sale-item b,.sale-item strong{font-size:14px}.sale-total{padding:5px 8px}.totals{gap:4px}.totals>div{padding:7px 6px;border-radius:10px}.totals small{margin-bottom:3px}.totals b,.totals strong{font-size:14px}.foot{font-size:9px;margin-top:6px}.store-head,.remaining{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>'));popup.document.close();popup.focus();setTimeout(()=>{try{popup.print()}catch{}},500);
}
function PoultryCustomersView({ mode = 'customers', session }: { mode?: 'customers' | 'sales' | 'collections'; session: SessionUser | null }) {
  const [, setLocation] = useLocation();
  const [customers,setCustomers]=useState<PoultryCustomer[]>([]);
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<PoultryCustomer|null>(null);
  const [statement,setStatement]=useState<PoultryStatement|null>(null);
  const [from,setFrom]=useState(new Date().toISOString().slice(0,8)+'01');
  const [to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [customerDialog,setCustomerDialog]=useState(false);
  const [editingCustomer,setEditingCustomer]=useState<PoultryCustomer|null>(null);
  const [newCustomer,setNewCustomer]=useState({name:'',phone:'',shopName:'',shopAddress:''});
  const [editCustomerForm,setEditCustomerForm]=useState({name:'',phone:'',shopName:'',shopAddress:''});
  const [invoice,setInvoice]=useState({productName:'فراخ',quantityKg:'',unitPrice:'',deadWeightKg:'',amountPaid:''});
  const [payment,setPayment]=useState('');
  const [lastInvoice,setLastInvoice]=useState<PoultryInvoiceResult|null>(null);

  const pageMode=mode;
  const canAddCustomer=pageMode==='customers' && hasAppRole(session,['tenant_admin','cashier','customer_management']);
  const canEditCustomer=pageMode==='customers' && hasAppRole(session,['tenant_admin','customer_management']);
  const canSell=pageMode==='sales' && hasAppRole(session,['tenant_admin','cashier','retail_sales']);
  const canCollect=pageMode==='collections' && hasAppRole(session,['tenant_admin','cashier','collector']);

  async function loadCustomers(q=search){
    const rows = await poultryApi.listCustomers(q);
    const nextRows = Array.isArray(rows) ? rows : [];
    setCustomers(nextRows);
    setSelected((current: any | null) => current ? (nextRows.find(row => row.id === current.id) || current) : current);
  }

  useEffect(()=>{void loadCustomers().catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل العملاء.'));},[]);

  async function createCustomer(){
    const payload={
      name:newCustomer.name.trim(),
      phone:newCustomer.phone.trim(),
      shopName:newCustomer.shopName.trim(),
      shopAddress:newCustomer.shopAddress.trim(),
    };
    if(!payload.name){
      setError('اكتب اسم العميل قبل الحفظ.');
      return;
    }
    setBusy(true);setError('');setNotice('');
    try{
      const j = await poultryApi.createCustomer(payload);
      setNewCustomer({name:'',phone:'',shopName:'',shopAddress:''});
      setCustomerDialog(false);
      setNotice('تم إضافة العميل بنجاح. اختاره الآن وسجّل أول فاتورة.');
      await loadCustomers();
      setSelected({ ...j, balance: 0, totalSales: 0, totalPaid: 0 });
      setStatement(null);
    }catch(e){
      setError(e instanceof Error?e.message:'تعذر إضافة العميل.');
    }finally{setBusy(false);}
  }

  function openEditCustomer(customer:PoultryCustomer){
    setError('');
    setEditCustomerForm({name:customer.name||'',phone:customer.phone||'',shopName:customer.shopName||'',shopAddress:customer.shopAddress||''});
    setEditingCustomer(customer);
  }

  async function updateCustomer(){
    if(!editingCustomer)return;
    const payload={name:editCustomerForm.name.trim(),phone:editCustomerForm.phone.trim(),shopName:editCustomerForm.shopName.trim(),shopAddress:editCustomerForm.shopAddress.trim()};
    if(!payload.name){setError('اكتب اسم العميل قبل الحفظ.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const updated=await poultryApi.updateCustomer(editingCustomer.id,payload);
      setCustomers(current=>current.map(row=>row.id===updated.id?{...row,...updated}:row));
      setSelected(current=>current&&current.id===updated.id?{...current,...updated}:current);
      setEditingCustomer(null);
      setNotice('تم تحديث بيانات العميل بنجاح.');
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحديث بيانات العميل.');}
    finally{setBusy(false);}
  }

  async function loadStatement(customer=selected){
    if(!customer)return;
    setBusy(true);setError('');
    try{
      const result = await poultryApi.getStatement(customer.id, from, to);
      setStatement(result);
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل كشف الحساب.');}
    finally{setBusy(false);}
  }

  const invoiceGrossTotal=roundMoney((Number(invoice.quantityKg)||0)*(Number(invoice.unitPrice)||0));
  const deadWeightKg=Math.max(0,Number(invoice.deadWeightKg)||0);
  const deadTotal=roundMoney(deadWeightKg*(Number(invoice.unitPrice)||0));
  const invoiceTotal=roundMoney(Math.max(0,invoiceGrossTotal-deadTotal));
  const amountReceivedToday=Math.max(0,Number(invoice.amountPaid)||0);
  const paidOnInvoice=Math.min(invoiceTotal,amountReceivedToday);
  const extraCollection=Math.max(0,roundMoney(amountReceivedToday-invoiceTotal));
  const invoiceRemaining=Math.max(0,roundMoney(invoiceTotal-paidOnInvoice));

  async function createInvoice(){
    if(!selected){setError('اختَر العميل أولاً.');return;}
    const quantity=Number(invoice.quantityKg);
    const unitPrice=Number(invoice.unitPrice);
    const amountReceived=Number(invoice.amountPaid)||0;
    if(!Number.isFinite(quantity)||quantity<=0){setError('اكتب كمية بالكيلو أكبر من صفر.');return;}
    if(!Number.isFinite(unitPrice)||unitPrice<0){setError('اكتب سعر الكيلو بشكل صحيح.');return;}
    if(!Number.isFinite(amountReceived)||amountReceived<0){setError('اكتب المبلغ المدفوع اليوم بشكل صحيح.');return;}
    const grossTotal=roundMoney(quantity*unitPrice);
    const deadTotalForInvoice=roundMoney(deadWeightKg*unitPrice);
    const total=roundMoney(Math.max(0,grossTotal-deadTotalForInvoice));
    if(amountReceived<0){setError('المبلغ المدفوع اليوم لا يمكن أن يكون سالبًا.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const j = await poultryApi.createInvoice(selected.id, { items: [{ productName: invoice.productName.trim() || 'فراخ', quantityKg: quantity, unitPrice, deadWeightKg }], amountPaid: amountReceived });
      setLastInvoice(j);
      setNotice(j.extraCollection>0
        ? 'تم تسجيل الفاتورة بقيمة '+fmt(j.total)+' ج.م، وتسجيل '+fmt(j.extraCollection)+' ج.م تحصيلًا من الرصيد السابق.'
        : 'تم تسجيل الفاتورة '+j.invoiceNo+' بقيمة '+fmt(j.total)+' ج.م.');
      setInvoice({productName:'فراخ',quantityKg:'',unitPrice:'',deadWeightKg:'',amountPaid:''});
      await loadCustomers();
      await loadStatement(selected);
    }catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل الفاتورة.');}
    finally{setBusy(false);}
  }

  async function collectPayment(){
    if(!selected){setError('اختَر العميل أولاً.');return;}
    const amount=Number(payment);
    if(!Number.isFinite(amount)||amount<=0){setError('اكتب مبلغ تحصيل أكبر من صفر.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const j = await poultryApi.collectPayment(selected.id, amount);
      setNotice('تم تسجيل تحصيل '+fmt(j.amount)+' ج.م.');
      setPayment('');
      await loadCustomers();
      await loadStatement(selected);
    }catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل التحصيل.');}
    finally{setBusy(false);}
  }

  function whatsappInvoice(){
    if(!lastInvoice||!selected)return;
    const text='فاتورة '+lastInvoice.invoiceNo+'\nالعميل: '+selected.name+'\nالقيمة: '+fmt(lastInvoice.total)+' ج.م\nالمدفوع على الفاتورة: '+fmt(lastInvoice.amountPaid)+' ج.م\nتحصيل من الرصيد السابق: '+fmt(lastInvoice.extraCollection||0)+' ج.م\nإجمالي المدفوع اليوم: '+fmt(lastInvoice.amountReceived??lastInvoice.amountPaid)+' ج.م\nالمتبقي من الفاتورة: '+fmt(lastInvoice.balance)+' ج.م\nالتاريخ والوقت: '+new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(lastInvoice.createdAt));
    window.open('https://wa.me/'+String(selected.phone).replace(/\D/g,'')+'?text='+encodeURIComponent(text),'_blank');
  }

  async function buildStatementImageBlob(): Promise<Blob|null>{
    if(!selected||!statement)return null;
    const rows=statement.rows,width=1200,rowHeight=205,height=620+Math.max(rows.length,1)*rowHeight,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)return null;ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#f1f5f2';ctx.fillRect(0,0,width,height);
    const card=(x:number,y:number,w:number,h:number,fill='#fff')=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)},txt=(v:string,x:number,y:number,s:number,w='600',c='#17251b')=>{ctx.fillStyle=c;ctx.font=w+' '+s+'px Arial';ctx.fillText(v,x,y)},wrap=(v:string,x:number,y:number,max:number,s:number,w='600',c='#17251b')=>{ctx.fillStyle=c;ctx.font=w+' '+s+'px Arial';let line='',yy=y;for(const word of String(v).split(' ')){const t=line?line+' '+word:word;if(ctx.measureText(t).width>max&&line){ctx.fillText(line,x,yy);line=word;yy+=s+7}else line=t}if(line)ctx.fillText(line,x,yy)};
    card(0,0,width,190,'#173f2b');txt('كشف حساب عميل',width-60,70,42,'800','#fff');txt(selected.name,width-60,112,25,'800','#fff');txt('الفترة: '+from+' إلى '+to,width-60,150,20,'600','#fff');
    const x=55,w=width-110;card(x,215,w,145);txt('بيانات الحساب',width-80,250,18,'800','#718078');txt('المحل: '+(selected.shopName||'—'),width-80,285,21,'700');txt('الهاتف: '+selected.phone,width-80,320,21,'700');txt('رصيد أول الفترة: '+fmt(statement.openingBalance)+' ج.م',width-80,348,21,'700');
    let y=385;rows.forEach((row:any)=>{card(x,y,w,rowHeight-15);txt(row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):'تحصيل',width-80,y+35,22,'800',row.type==='payment'?'#24553b':'#17251b');const date=new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date));const qty=row.items?.length?fmt(row.items.reduce((s:number,i:any)=>s+Number(i.quantityKg||0),0))+' كجم':'—';const price=row.items?.length?fmt(row.items[0].unitPrice)+' ج.م':'—';const value=fmt(row.type==='invoice'?row.total:row.paid)+' ج.م';const fields=[['التاريخ والوقت',date],['الكيلو',qty],['سعر الكيلو',price],['القيمة',value],['الموظف',row.actorName||'—']];fields.forEach((f,i)=>wrap(f[0]+' : '+f[1],width-80-(i%2)*540,y+65+Math.floor(i/2)*55,500,17,'700'));if(row.type==='payment'&&row.note)wrap('ملاحظة: '+row.note,width-80,y+170,1040,16,'600','#63746a');y+=rowHeight});
    y+=8;[['إجمالي الكمية',fmt(statement.summary.totalKg)+' كجم'],['المبيعات',fmt(statement.summary.sales)+' ج.م'],['التحصيلات',fmt(statement.summary.paid)+' ج.م'],['الرصيد المتبقي',fmt(statement.summary.remaining)+' ج.م']].forEach((f,i)=>{const bx=x+(i%2)*540,by=y+Math.floor(i/2)*95;card(bx,by,500,78,i===3?'#173f2b':'#fff');txt(f[0],bx+478,by+29,17,'700',i===3?'#d8e5da':'#718078');txt(f[1],bx+478,by+61,24,'800',i===3?'#fff':'#17251b')});
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
  }
  async function shareStatement(){
    const blob=await buildStatementImageBlob();if(!blob||!selected)return;
    const imageFile=new File([blob],'كشف-حساب-'+selected.name+'.jpg',{type:'image/jpeg'});
    try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[imageFile]}))){await navigator.share({files:[imageFile],title:'كشف حساب '+selected.name,text:'كشف حساب '+selected.name});return}}catch(e:any){if(e?.name==='AbortError')return}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=imageFile.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function statementRowsText(){
    if(!selected||!statement)return '';
    const s=statement.summary;
    const rows=statement.rows.map((row:any)=>[
      new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{day:'numeric',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date)),
      row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):'تحصيل',
      row.items?.length?fmt(row.items.reduce((sum:number,item:any)=>sum+Number(item.quantityKg||0),0))+' كجم':'—',
      fmt(row.type==='invoice'?row.total:row.paid)+' ج.م',
      row.actorName||'—'
    ].join(' | '));
    return 'كشف حساب '+selected.name+'\\nالمحل: '+(selected.shopName||'—')+'\\nالهاتف: '+selected.phone+'\\nالفترة: '+from+' إلى '+to+'\\nرصيد أول الفترة: '+fmt(statement.openingBalance)+' ج.م\\n'+rows.join('\\n')+'\\nإجمالي الكمية: '+fmt(s.totalKg)+' كجم\\nالمبيعات: '+fmt(s.sales)+' ج.م\\nالتحصيلات: '+fmt(s.paid)+' ج.م\\nالرصيد المتبقي: '+fmt(s.remaining)+' ج.م';
  }

  function whatsappStatement(){
    if(!selected||!statement)return;
    const text=statementRowsText();
    window.open('https://wa.me/'+String(selected.phone).replace(/\\D/g,'')+'?text='+encodeURIComponent(text),'_blank');
  }

  async function downloadStatement(){const blob=await buildStatementImageBlob();if(!blob||!selected||!statement)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='كشف-حساب-'+selected.name+'-'+from+'-'+to+'.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}

  function printStatement(){
    if(!selected||!statement)return;
    const popup=window.open('','_blank');
    if(!popup){setError('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');return;}
    const esc=(value:any)=>String(value??'').replace(/[&<>"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]||char));
    const rows=statement.rows.map((row:any)=>'<tr><td>'+esc(new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{day:'numeric',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date)))+'</td><td>'+esc(row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):'تحصيل')+'</td><td>'+esc(row.items?.length?fmt(row.items.reduce((sum:number,item:any)=>sum+Number(item.quantityKg||0),0))+' كجم':'—')+'</td><td>'+esc(fmt(row.type==='invoice'?row.total:row.paid))+' ج.م</td><td>'+esc(row.actorName||'—')+'</td></tr>').join('');
    popup.document.open();
    popup.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>كشف حساب '+esc(selected.name)+'</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#17251b;padding:0;direction:rtl;font-size:12px}h1{font-size:23px;margin:0 0 8px}.muted{color:#526257;font-size:13px;line-height:1.9}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}.summary div{border:1px solid #ccd8ce;padding:12px;border-radius:8px}.summary small{display:block;color:#526257;margin-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d6ddd7;padding:9px;text-align:right;font-size:12px}th{background:#edf3ed}.foot{margin-top:18px;font-size:12px;color:#526257}@media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary div{break-inside:avoid}table{break-inside:auto}tr{break-inside:avoid;break-after:auto}}</style></head><body><h1>كشف حساب عميل</h1><div class="muted">اسم العميل: '+esc(selected.name)+'<br>المحل: '+esc(selected.shopName||'—')+'<br>الهاتف: '+esc(selected.phone)+'<br>الفترة: '+esc(from)+' إلى '+esc(to)+'<br>رصيد أول الفترة: '+esc(fmt(statement.openingBalance))+' ج.م</div><div class="summary"><div><small>إجمالي الكمية</small><b>'+esc(fmt(statement.summary.totalKg))+' كجم</b></div><div><small>المبيعات</small><b>'+esc(fmt(statement.summary.sales))+' ج.م</b></div><div><small>التحصيلات</small><b>'+esc(fmt(statement.summary.paid))+' ج.م</b></div><div><small>الرصيد المتبقي</small><b>'+esc(fmt(statement.summary.remaining))+' ج.م</b></div></div><table><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الكمية</th><th>القيمة</th><th>الموظف</th></tr></thead><tbody>'+rows+'</tbody></table><div class="foot">تم استخراج الكشف من نظام X-Store</div></body></html>');
    popup.document.close();
    popup.focus();
    window.setTimeout(()=>{try{popup.print();}catch{}},800);
  }

  return <div dir="rtl" className="poultry-customers-page">
    <PageTitle
      eyebrow="الدواجن والفراخ"
      title={pageMode==='customers'?'العملاء':pageMode==='sales'?'بيع الدواجن بالكيلو':'تحصيل حسابات العملاء'}
      desc={pageMode==='customers'?'إضافة العملاء والبحث عن بياناتهم.':pageMode==='sales'?'اختَر العميل وسجّل فاتورة الدواجن بالكيلو وسعر الكيلو.':'اختَر العميل وسجّل المبالغ المحصلة وراجع كشف الحساب.'}
      action={<div className="poultry-header-actions">
        {canAddCustomer&&<button className="button button-primary" onClick={()=>{setError('');setCustomerDialog(true);}}><Plus size={17}/> عميل جديد</button>}
        <button className="button button-quiet" onClick={()=>window.print()}><Printer size={16}/> طباعة</button>
      </div>}
    />
    {error&&<div className="form-error poultry-form-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}    {notice&&<div className="notice-box success poultry-form-notice"><CircleCheck size={16}/><span>{notice}</span></div>}

    {pageMode==='sales'&&<div className="poultry-step-strip" aria-label="خطوات البيع">
      <div className="poultry-step"><b>1</b><span>اختَر العميل</span></div>
      <ArrowLeft size={16}/>
      <div className="poultry-step"><b>2</b><span>اكتب الكيلو وسعر الكيلو</span></div>
      <ArrowLeft size={16}/>
      <div className="poultry-step"><b>3</b><span>سجّل الفاتورة</span></div>
      <ArrowLeft size={16}/>
      <div className="poultry-step"><b>4</b><span>حصّل أو اتركها آجل</span></div>
    </div>}

    <div className="dashboard-grid poultry-grid">
      <Card className="poultry-customers-card">
        <SectionHead title="العملاء" detail="ابحث بالاسم أو الهاتف أو اسم المحل." action={canAddCustomer?<button className="text-link" onClick={()=>setCustomerDialog(true)}><Plus size={15}/> إضافة عميل</button>:null}/>
        <div className="poultry-search-row">
          <label className="search-box poultry-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="اسم العميل أو الهاتف أو المحل" /></label>
          <button className="button button-quiet" onClick={()=>void loadCustomers(search)} disabled={busy}><Search size={15}/> بحث</button>
        </div>
        <div className="poultry-customer-list">
          {customers.length?customers.map(c=><button type="button" className={'poultry-customer '+(selected?.id===c.id?'selected':'')} key={c.id} onClick={()=>{if(pageMode==='sales'){setLocation('/poultry-sale/'+encodeURIComponent(c.id));return;}if(pageMode==='customers'){setLocation('/poultry-customer/'+encodeURIComponent(c.id));return;}setSelected(c);setStatement(null);setError('');void loadStatement(c).catch(e=>setError(e instanceof Error?e.message:'تعذر تحميل كشف الحساب.'));}}>
            <span className="poultry-customer-icon"><Bird size={18}/></span>
            <span><b>{c.name}</b><small>{c.shopName||'بدون اسم محل'} · {c.phone}</small></span>
            <strong>{fmt(c.balance)} ج.م</strong>
          </button>):<div className="state-box"><div className="empty-symbol"><Bird size={22}/></div><b>لا يوجد عملاء</b><span>ابدأ بزر «عميل جديد» وأضف أول حساب.</span></div>}
        </div>
      </Card>

      <Card className="poultry-workspace-card">
        {selected?<>
          <SectionHead title={'حساب '+selected.name} detail={(selected.shopName||'بدون اسم محل')+' · '+selected.phone} action={canEditCustomer?<button className="text-link" onClick={()=>openEditCustomer(selected)}><PencilIcon size={15}/> تعديل بيانات العميل</button>:null}/>
          <div className="poultry-customer-meta">
            <span><b>المحل</b>{selected.shopName||'—'}</span>
            <span><b>العنوان</b>{selected.shopAddress||'—'}</span>
            <span><b>{Number(selected.balance)>0?'المبلغ المستحق للسداد':Number(selected.balance)<0?'رصيد لصالح العميل':'الحساب متسدد'}</b><strong className={Number(selected.balance)>0?'poultry-balance-due':'poultry-balance-clear'}>{fmt(Math.abs(Number(selected.balance)||0))} ج.م</strong></span>
          </div>

          {canSell&&<div className="poultry-action-box poultry-sale-box">
            <div className="poultry-box-heading"><div><span className="poultry-box-kicker">الخطوة 2 و 3</span><h3>بيع دواجن للعميل</h3><p>اكتب الوزن وسعر الكيلو فقط، والإجمالي يتحسب تلقائياً.</p></div><span className="poultry-sale-badge"><Bird size={18}/> بيع بالكيلو</span></div>
            <div className="form-grid poultry-sale-form">
              <label className="field"><span>الصنف</span><input value={invoice.productName} onChange={e=>setInvoice({...invoice,productName:e.target.value})} placeholder="مثال: فراخ بيضاء"/></label>
              <label className="field"><span>الكمية بالكيلو <b className="required-mark">*</b></span><input type="number" min="0.001" step="0.001" value={invoice.quantityKg} onChange={e=>setInvoice({...invoice,quantityKg:e.target.value})} placeholder="مثال: 12.500"/></label>
              <label className="field"><span>سعر الكيلو <b className="required-mark">*</b></span><input type="number" min="0" step="0.01" value={invoice.unitPrice} onChange={e=>setInvoice({...invoice,unitPrice:e.target.value})} placeholder="مثال: 145"/></label>
              <label className="field"><span>نافِق (كجم)</span><input type="number" min="0" step="0.001" max={Number(invoice.quantityKg)||undefined} value={invoice.deadWeightKg} onChange={e=>setInvoice({...invoice,deadWeightKg:e.target.value})} placeholder="مثال: 10"/></label>
              <label className="field"><span>المبلغ المدفوع اليوم</span><input type="number" min="0" step="0.01" value={invoice.amountPaid} onChange={e=>setInvoice({...invoice,amountPaid:e.target.value})} placeholder="0 = آجل بالكامل"/></label>
            </div>
            <div className="poultry-sale-calculation">
              <div><span>الوزن</span><b>{fmt(Number(invoice.quantityKg)||0)} كجم</b></div>
              <div><span>سعر الكيلو</span><b>{fmt(Number(invoice.unitPrice)||0)} ج.م</b></div>
              <div><span>نافِق</span><b>{fmt(deadWeightKg)} كجم · {fmt(deadTotal)} ج.م</b></div>
              <div className="total"><span>إجمالي الفاتورة</span><strong>{fmt(invoiceTotal)} ج.م</strong></div>
              <div><span>مدفوع على الفاتورة</span><b>{fmt(paidOnInvoice)} ج.م</b></div>
              <div><span>تحصيل من الرصيد السابق</span><b>{fmt(extraCollection)} ج.م</b></div>
              <div><span>متبقي هذه الفاتورة</span><b>{fmt(invoiceRemaining)} ج.م</b></div>
            </div>
            <button className="button button-primary poultry-main-action" disabled={busy||invoiceTotal<=0} onClick={()=>void createInvoice()}><ReceiptText size={17}/> تسجيل الفاتورة وحفظ سعر الكيلو</button>
            <small className="poultry-helper">المبلغ المدفوع اليوم يمكن أن يكون أكبر من الفاتورة: النظام يثبت قيمة الفاتورة أولًا، والباقي يُسجل تلقائيًا كتحصيل من رصيد العميل السابق.</small>
          </div>}

          {canCollect&&<div className="poultry-action-box poultry-collection-box">
            <div className="poultry-box-heading"><div><span className="poultry-box-kicker">الخطوة 4</span><h3>تحصيل من العميل</h3><p>لو العميل دفع جزء أو كل الحساب، سجّل المبلغ هنا.</p></div><span className="poultry-collection-badge"><Wallet size={18}/> تحصيل</span></div>
            <div className="form-grid"><label className="field"><span>مبلغ التحصيل</span><input type="number" min="0.01" step="0.01" value={payment} onChange={e=>setPayment(e.target.value)} placeholder="مثال: 1000"/></label></div>
            <button className="button button-primary" disabled={busy||!payment} onClick={()=>void collectPayment()}><Wallet size={16}/> تسجيل التحصيل</button>
          </div>}

          {!canSell&&!canCollect&&<div className="role-hint poultry-permission-note"><ShieldCheck size={17}/><span>حسابك للعرض فقط. اطلب من مالك المتجر إضافة صلاحية البيع أو التحصيل من «فريق العمل».</span></div>}

          {(pageMode==='collections'||pageMode==='customers')&&<div className="poultry-statement-controls">
            <SectionHead title="كشف الحساب" detail="حدد الفترة ثم اعرض كل الفواتير والتحصيلات."/>
            <div className="form-grid"><label className="field"><span>من تاريخ</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field"><span>إلى تاريخ</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
            <div className="form-actions"><button className="button button-primary" onClick={()=>void loadStatement()} disabled={busy}><ReceiptText size={16}/> عرض كشف الحساب</button>{statement&&<><button className="button button-quiet" onClick={shareStatement}><Share2 size={16}/> مشاركة</button><button className="button button-quiet" onClick={whatsappStatement}><MessageCircle size={16}/> واتساب</button><button className="button button-quiet" onClick={printStatement}><Printer size={16}/> طباعة / PDF</button><button className="button button-quiet" onClick={downloadStatement}><Download size={16}/> تنزيل كشف الحساب JPG</button></>}</div>
          </div>}

          {pageMode==='sales'&&lastInvoice&&<div className="notice-box success poultry-last-invoice"><b>آخر فاتورة: {lastInvoice.invoiceNo}</b><span>القيمة {fmt(lastInvoice.total)} ج.م · المدفوع على الفاتورة {fmt(lastInvoice.amountPaid)} ج.م · تحصيل من الرصيد السابق {fmt(lastInvoice.extraCollection||0)} ج.م · المتبقي من الفاتورة {fmt(lastInvoice.balance)} ج.م</span><div className="form-actions"><button className="button button-quiet" onClick={()=>shareUnifiedInvoiceImage(lastInvoice,selected,lastInvoiceDetails,session?.invoiceSettings)}><Share2 size={16}/> مشاركة</button><button className="button button-quiet" onClick={whatsappInvoice}><MessageCircle size={16}/> إرسال الفاتورة واتساب</button><button className="button button-quiet" onClick={()=>window.print()}><Printer size={16}/> طباعة / PDF</button></div></div>}
        </>:<div className="poultry-empty-workspace"><div className="empty-symbol"><Bird size={28}/></div><h3>اختَر عميلًا للبدء</h3><p>بعد اختيار العميل هتظهر لك شاشة البيع بالكيلو والتحصيل وكشف الحساب.</p>{canAddCustomer&&<button className="button button-primary" onClick={()=>setCustomerDialog(true)}><Plus size={16}/> إضافة أول عميل</button>}</div>}
      </Card>
    </div>

    {(pageMode==='collections'||pageMode==='customers')&&statement&&<Card className="poultry-statement">
      <SectionHead title="تفاصيل كشف الحساب" detail={'من '+from+' إلى '+to}/>
      <div className="stat-grid">
        <StatCard label="إجمالي الكمية" value={fmt(statement.summary.totalKg)+' كجم'} detail="إجمالي الوزن خلال الفترة" icon={Bird}/>
        <StatCard label="المبيعات" value={fmt(statement.summary.sales)+' ج.م'} detail="قيمة الفواتير" icon={ReceiptText} tint="gold"/>
        <StatCard label="المدفوع" value={fmt(statement.summary.paid)+' ج.م'} detail="إجمالي التحصيل" icon={Wallet} tint="sage"/>
        <StatCard label="المتبقي" value={fmt(statement.summary.remaining)+' ج.م'} detail="الرصيد بعد الفترة" icon={CreditCard}/>
      </div>
      <div className="table-wrap"><table><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الكيلو</th><th>سعر الكيلو</th><th>القيمة</th><th>الموظف</th></tr></thead><tbody>
        {statement.rows.map((row:any)=><tr key={row.id} className={row.type==='payment'?'poultry-payment-row':''}><td>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date))}</td><td><b>{row.type==='invoice'?'فاتورة '+row.invoiceNo:'تحصيل'}</b>{row.type==='payment'&&row.note&&<small className="poultry-payment-note">{row.note}</small>}</td><td>{row.items.length?fmt(row.items.reduce((s:number,x:any)=>s+x.quantityKg,0)):'—'}</td><td>{row.items.length?fmt(row.items[0].unitPrice)+' ج.م':'—'}</td><td>{fmt(row.type==='invoice'?row.total:row.paid)} ج.م</td><td>{row.actorName}</td></tr>)}
      </tbody></table></div>
    </Card>}

    {pageMode==='customers'&&editingCustomer&&<Modal title="تعديل بيانات العميل" close={()=>{if(!busy)setEditingCustomer(null);}}>
      <form className="poultry-customer-form" onSubmit={e=>{e.preventDefault();void updateCustomer();}}>
        <div className="poultry-modal-intro"><div className="poultry-modal-icon"><PencilIcon size={22}/></div><div><b>تعديل بيانات العميل</b><span>عدّل الاسم أو الهاتف أو بيانات المحل، ثم احفظ.</span></div></div>
        <div className="form-grid">
          <label className="field field-wide"><span>اسم صاحب المحل <b className="required-mark">*</b></span><input required autoFocus value={editCustomerForm.name} onChange={e=>setEditCustomerForm({...editCustomerForm,name:e.target.value})} /></label>
          <label className="field"><span>رقم الهاتف <span className="optional-mark">اختياري</span></span><input type="tel" inputMode="tel" value={editCustomerForm.phone} onChange={e=>setEditCustomerForm({...editCustomerForm,phone:e.target.value})} /></label>
          <label className="field"><span>اسم المحل</span><input value={editCustomerForm.shopName} onChange={e=>setEditCustomerForm({...editCustomerForm,shopName:e.target.value})} /></label>
          <label className="field field-wide"><span>عنوان المحل</span><input value={editCustomerForm.shopAddress} onChange={e=>setEditCustomerForm({...editCustomerForm,shopAddress:e.target.value})} /></label>
        </div>
        <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setEditingCustomer(null)} disabled={busy}>إلغاء</button><button className="button button-primary" type="submit" disabled={busy||!editCustomerForm.name.trim()}><PencilIcon size={16}/>{busy?'جارٍ الحفظ…':'حفظ التعديل'}</button></div>
      </form>
    </Modal>}
    {pageMode==='customers'&&customerDialog&&<Modal title="إضافة عميل دواجن" close={()=>{if(!busy)setCustomerDialog(false);}}>
      <form className="poultry-customer-form" onSubmit={e=>{e.preventDefault();void createCustomer();}}>
        <div className="poultry-modal-intro"><div className="poultry-modal-icon"><Bird size={22}/></div><div><b>بيانات العميل الأساسية</b><span>الاسم فقط مطلوب. باقي البيانات اختيارية.</span></div></div>
        <div className="form-grid">
          <label className="field field-wide"><span>اسم صاحب المحل <b className="required-mark">*</b></span><input required autoFocus value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer,name:e.target.value})} placeholder="مثال: أحمد محمد"/></label>
          <label className="field"><span>رقم الهاتف <span className="optional-mark">اختياري</span></span><input type="tel" inputMode="tel" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})} placeholder="01xxxxxxxxx"/></label>
          <label className="field"><span>اسم المحل</span><input value={newCustomer.shopName} onChange={e=>setNewCustomer({...newCustomer,shopName:e.target.value})} placeholder="مثال: محل البركة"/></label>
          <label className="field field-wide"><span>عنوان المحل</span><input value={newCustomer.shopAddress} onChange={e=>setNewCustomer({...newCustomer,shopAddress:e.target.value})} placeholder="المنطقة / الشارع"/></label>
        </div>
        <div className="poultry-form-explain"><ShieldCheck size={16}/><span>بعد الحفظ هتقدر تختار العميل فورًا وتسجل له البيع بالكيلو أو التحصيل.</span></div>
        <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setCustomerDialog(false)} disabled={busy}>إلغاء</button><button className="button button-primary" type="submit" disabled={busy||!newCustomer.name.trim()}><Plus size={16}/>{busy?'جارٍ إضافة العميل…':'حفظ العميل'}</button></div>
      </form>
    </Modal>}
  </div>;
}

function PoultryCustomerAccountPageView({ session }: { session: SessionUser | null }) {
  const [, setLocation]=useLocation();
  const [, params]=useRoute('/poultry-customer/:customerId');
  const customerId=params?.customerId?decodeURIComponent(params.customerId):'';
  const [customer,setCustomer]=useState<PoultryCustomer|null>(null);
  const [statement,setStatement]=useState<PoultryStatement|null>(null);
  const [from,setFrom]=useState(new Date().toISOString().slice(0,8)+'01');
  const [to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [editingCustomer,setEditingCustomer]=useState<PoultryCustomer|null>(null);
  const [editForm,setEditForm]=useState({name:'',phone:'',shopName:'',shopAddress:''});
  const [debtOpen,setDebtOpen]=useState(false),[debtAmount,setDebtAmount]=useState(''),[debtNote,setDebtNote]=useState('');
  const canEditCustomer=hasAppRole(session,['tenant_admin','customer_management']);
  const canAddDebt=hasAppRole(session,['tenant_admin','cashier','accountant','customer_management']);
  async function loadAccount(showLoading=true){
    if(showLoading)setLoading(true);setError('');
    try{const rows=await poultryApi.listCustomers();const found=rows.find(row=>row.id===customerId);if(!found)throw new Error('لم يتم العثور على العميل.');setCustomer(found);setStatement(await poultryApi.getStatement(customerId,from,to));}
    catch(e){setError(e instanceof Error?e.message:'تعذر تحميل حساب العميل.');}
    finally{if(showLoading)setLoading(false);}
  }
  useEffect(()=>{void loadAccount();},[customerId]);
  function openEdit(){if(!customer)return;setEditForm({name:customer.name||'',phone:customer.phone||'',shopName:customer.shopName||'',shopAddress:customer.shopAddress||''});setEditingCustomer(customer);}
  async function saveEdit(){if(!editingCustomer)return;if(!editForm.name.trim()){setError('اسم العميل مطلوب.');return;}setBusy(true);setError('');setNotice('');try{await poultryApi.updateCustomer(editingCustomer.id,{name:editForm.name.trim(),phone:editForm.phone.trim(),shopName:editForm.shopName.trim(),shopAddress:editForm.shopAddress.trim()});setEditingCustomer(null);setNotice('تم تعديل بيانات العميل بنجاح.');await loadAccount(false);}catch(e){setError(e instanceof Error?e.message:'تعذر تعديل بيانات العميل.');}finally{setBusy(false);}}
  async function saveManualDebt(){const amount=Number(debtAmount),note=debtNote.trim();if(!Number.isFinite(amount)||amount<=0){setError('اكتب مبلغ مديونية أكبر من صفر.');return;}if(!note){setError('اكتب ملاحظة المديونية.');return;}setBusy(true);setError('');setNotice('');try{await poultryApi.addManualDebt(customerId,amount,note);setDebtAmount('');setDebtNote('');setDebtOpen(false);setNotice('تمت إضافة المديونية وإدخالها في كشف الحساب بالملاحظة.');await loadAccount(false);}catch(e){setError(e instanceof Error?e.message:'تعذر إضافة المديونية.');}finally{setBusy(false);}}
  if(loading)return <div dir="rtl" className="loading-page"><div className="loading-card"><span className="skeleton-logo"/><span className="skeleton-line"/><span className="skeleton-line short"/></div></div>;
  return <div dir="rtl" className="poultry-customers-page"><PageTitle eyebrow="حسابات العملاء" title={customer?'حساب '+customer.name:'حساب العميل'} desc="بيانات العميل وكشف حسابه خلال الفترة التي تحددها." action={<div className="poultry-header-actions">
    <button className="button button-quiet" onClick={()=>setLocation('/poultry-customers')}><ArrowLeft size={16}/> رجوع للعملاء</button>
    {canEditCustomer&&customer&&<button className="button button-quiet" onClick={openEdit}><PencilIcon size={16}/> تعديل بيانات العميل</button>}
    {canAddDebt&&customer&&<button className="button button-primary" onClick={()=>{setError('');setNotice('');setDebtOpen(true);}}><Plus size={16}/> إضافة حساب يدوي</button>}
  </div>}/>
  {error&&<div className="form-error poultry-form-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}{notice&&<div className="notice-box success poultry-form-notice"><CircleCheck size={16}/><span>{notice}</span></div>}
  {customer&&<Card className="poultry-workspace-card"><SectionHead title={customer.name} detail={(customer.shopName||'بدون اسم محل')+' · '+(customer.phone||'بدون هاتف')}/><div className="poultry-customer-meta"><span><b>المحل</b>{customer.shopName||'—'}</span><span><b>العنوان</b>{customer.shopAddress||'—'}</span><span><b>الرصيد الحالي</b><strong className={Number(customer.balance)>0?'poultry-balance-due':'poultry-balance-clear'}>{fmt(Math.abs(Number(customer.balance)||0))} ج.م</strong></span></div>
  <div className="poultry-statement-controls"><SectionHead title="كشف الحساب" detail="اختَر الفترة التي تريد مراجعة الحساب خلالها."/><div className="form-grid"><label className="field"><span>من تاريخ</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field"><span>إلى تاريخ</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><div className="form-actions"><button className="button button-primary" onClick={()=>void loadAccount(false)} disabled={busy}><ReceiptText size={16}/> عرض كشف الحساب</button>{statement&&<><button className="button button-quiet" onClick={()=>printCustomerStatement(customer,statement,from,to,session?.invoiceSettings)} disabled={busy}><Printer size={16}/> طباعة كشف الحساب</button><button className="button button-quiet" onClick={()=>void shareCustomerStatement(customer,statement,from,to,session?.invoiceSettings)} disabled={busy}><Share2 size={16}/> مشاركة كشف الحساب</button></>}</div></div>
  {statement&&<><div className="form-actions poultry-account-actions"><button className="button button-primary" onClick={()=>{setError('');setNotice('');setDebtOpen(true);}} disabled={busy}><Plus size={16}/> إضافة حساب يدوي</button><button className="button button-quiet" onClick={()=>void loadAccount(false)} disabled={busy}><RefreshCw size={16}/> تحديث الحساب</button></div><div className="stat-grid"><StatCard label="رصيد أول الفترة" value={fmt(statement.openingBalance)+' ج.م'} detail="المستحق قبل بداية الفترة" icon={CreditCard}/><StatCard label="مبيعات الفترة" value={fmt(statement.summary.sales)+' ج.م'} detail="قيمة الفواتير خلال الفترة" icon={ReceiptText} tint="gold"/><StatCard label="التحصيلات" value={fmt(statement.summary.paid)+' ج.م'} detail="المبالغ التي تم تحصيلها" icon={Wallet} tint="sage"/><StatCard label="الرصيد بعد الفترة" value={fmt(statement.summary.remaining)+' ج.م'} detail="المستحق بعد كل حركات الفترة" icon={CreditCard}/></div>
  <div className="table-wrap"><table><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الكمية</th><th>سعر الكيلو</th><th>القيمة</th><th>الموظف</th></tr></thead><tbody>{statement.rows.map(row=><tr key={row.id} className={row.type!=='invoice'?'poultry-payment-row':''}><td>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date))}</td><td><b>{row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):row.type==='manual_debt'?'مديونية يدوية':'تحصيل'}</b>{row.note&&<small className="poultry-payment-note">{row.note}</small>}</td><td>{row.items.length?fmt(row.items.reduce((s,x)=>s+x.quantityKg,0)):'—'}</td><td>{row.items.length?fmt(row.items[0].unitPrice)+' ج.م':'—'}</td><td>{fmt(row.type==='invoice'?row.total:Math.abs(row.paid))} ج.م</td><td>{row.actorName}</td></tr>)}</tbody></table></div></>}</Card>}
  {!customer&&<div className="state-box"><b>تعذر العثور على العميل</b><button className="button button-quiet" onClick={()=>setLocation('/poultry-customers')}>العودة للعملاء</button></div>}
  {editingCustomer&&<Modal title="تعديل بيانات العميل" close={()=>{if(!busy)setEditingCustomer(null);}}><form className="poultry-customer-form" onSubmit={e=>{e.preventDefault();void saveEdit();}}><div className="poultry-modal-intro"><div className="poultry-modal-icon"><PencilIcon size={22}/></div><div><b>تعديل بيانات العميل</b><span>عدّل بيانات العميل ثم احفظ.</span></div></div><div className="form-grid"><label className="field field-wide"><span>اسم صاحب المحل <b className="required-mark">*</b></span><input required autoFocus value={editForm.name} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></label><label className="field"><span>رقم الهاتف <span className="optional-mark">اختياري</span></span><input type="tel" value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/></label><label className="field"><span>اسم المحل</span><input value={editForm.shopName} onChange={e=>setEditForm({...editForm,shopName:e.target.value})}/></label><label className="field field-wide"><span>عنوان المحل</span><input value={editForm.shopAddress} onChange={e=>setEditForm({...editForm,shopAddress:e.target.value})}/></label></div><div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setEditingCustomer(null)} disabled={busy}>إلغاء</button><button className="button button-primary" type="submit" disabled={busy||!editForm.name.trim()}><PencilIcon size={16}/>{busy?'جارٍ الحفظ…':'حفظ التعديل'}</button></div></form></Modal>}
  {debtOpen&&<Modal title="إضافة حساب يدوي" close={()=>{if(!busy)setDebtOpen(false);}}><form className="poultry-customer-form" onSubmit={e=>{e.preventDefault();void saveManualDebt();}}><div className="poultry-modal-intro"><div className="poultry-modal-icon"><CreditCard size={22}/></div><div><b>إضافة مديونية يدوية</b><span>المبلغ سيُضاف مباشرة على رصيد العميل ويظهر في كشف الحساب بالملاحظة.</span></div></div><div className="form-grid"><label className="field field-wide"><span>المبلغ بالجنيه <b className="required-mark">*</b></span><input required type="number" min="0.01" step="0.01" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} placeholder="مثال: 500"/></label><label className="field field-wide"><span>ملاحظة <b className="required-mark">*</b></span><textarea rows={4} value={debtNote} onChange={e=>setDebtNote(e.target.value)} placeholder="مثال: حساب سابق / بضاعة لم تُسدد"/></label></div><div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setDebtOpen(false)} disabled={busy}>إلغاء</button><button className="button button-primary" type="submit" disabled={busy||!debtAmount||!debtNote.trim()}><Plus size={16}/>{busy?'جارٍ الحفظ…':'حفظ المديونية'}</button></div></form></Modal>}
  </div>;
}


function buildCustomerStatementText(customer:any,statement:any,from:string,to:string){
  const lines=[
    'كشف حساب العميل',
    'الاسم: '+String(customer?.name||'—'),
    'المحل: '+String(customer?.shopName||'غير مسجل'),
    'الهاتف: '+String(customer?.phone||'—'),
    'الفترة: من '+String(from||'—')+' إلى '+String(to||'—'),
    '',
    'رصيد أول الفترة: '+fmt(statement?.openingBalance||0)+' ج.م',
    'مبيعات الفترة: '+fmt(statement?.summary?.sales||0)+' ج.م',
    'التحصيلات: '+fmt(statement?.summary?.paid||0)+' ج.م',
    'الرصيد بعد الفترة: '+fmt(statement?.summary?.remaining||0)+' ج.م',
    '',
    'تفاصيل الحركات:'
  ];
  for(const row of (statement?.rows||[])){
    const movement=row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):row.type==='manual_debt'?'مديونية يدوية':'تحصيل';
    const value=fmt(row.type==='invoice'?row.total:Math.abs(row.paid||0))+' ج.م';
    const note=row.note?' — '+row.note:'';
    lines.push(
      new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{day:'numeric',month:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date))+
      ' | '+movement+' | '+value+note
    );
  }
  return lines.join('\n');
}

async function resolveCustomerStatementInvoiceSettings(settings?:PoultryInvoiceSettings|null):Promise<PoultryInvoiceSettings>{
  const fallback=invoiceSettingsOrDefault(settings);
  try{
    const response=await fetch('/api/xstore/session',{credentials:'include',headers:{Accept:'application/json'}});
    if(response.ok){
      const data=await response.json();
      const fresh=data?.user?.invoiceSettings ?? data?.invoiceSettings ?? null;
      if(fresh)return invoiceSettingsOrDefault(fresh);
    }
  }catch{}
  return fallback;
}

async function printCustomerStatement(customer:any,statement:any,from:string,to:string,settings?:PoultryInvoiceSettings){
  if(!statement)return;
  const effectiveSettings=await resolveCustomerStatementInvoiceSettings(settings);
  const popup=window.open('','_blank','width=900,height=1000');if(!popup)return;
  const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const invoiceSettings=customerStatementInvoiceSettings(effectiveSettings);
  const headerLines=invoiceSettings.showHeader?[invoiceSettings.headerStoreName,invoiceSettings.headerOwnerName,invoiceSettings.headerMessage,invoiceSettings.headerPhones].filter(line=>String(line||'').trim()):[];
  const statementHeader=headerLines.length?'<header style="display:grid;grid-template-columns:54px minmax(0,1fr) 54px;align-items:center;gap:12px;min-height:170px;padding:22px 18px;margin-bottom:18px;border-radius:24px;background:#173f2b;color:#fff;text-align:center"><span style="font-size:44px;line-height:1">🐔</span><div style="display:grid;gap:4px;min-width:0">'+headerLines.map((line,i)=>'<b style="display:block;overflow-wrap:anywhere;line-height:1.45;font-size:'+(i===0?'34px':i===1?'28px':'22px')+'">'+esc(line)+'</b>').join('')+'</div><span style="font-size:44px;line-height:1">🐔</span></header>':'';
  const rows=(statement.rows||[]).map((row:any)=>'<tr>'+
    '<td>'+esc(new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date)))+'</td>'+
    '<td><b>'+esc(row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):row.type==='manual_debt'?'مديونية يدوية':'تحصيل')+'</b>'+(row.note?'<small>'+esc(row.note)+'</small>':'')+'</td>'+
    '<td>'+esc(row.items?.length?fmt(row.items.reduce((sum:any,item:any)=>sum+Number(item.quantityKg||0),0))+' كجم':'—')+'</td>'+
    '<td>'+esc(row.items?.length?fmt(row.items[0].unitPrice)+' ج.م':'—')+'</td>'+
    '<td>'+esc(fmt(row.type==='invoice'?row.total:Math.abs(row.paid||0))+' ج.م')+'</td>'+
    '<td>'+esc(row.actorName||'—')+'</td>'+
  '</tr>').join('');
  popup.document.open();
  popup.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>كشف حساب '+esc(customer?.name||'')+'</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#202522;font-family:Arial,Tahoma,sans-serif;direction:rtl;padding:24px}.sheet{max-width:1000px;margin:auto}.store-head{display:grid;grid-template-columns:54px minmax(0,1fr) 54px;align-items:center;gap:12px;min-height:170px;padding:22px 18px;margin-bottom:18px;border-radius:24px;background:#173f2b;color:#fff;text-align:center}.store-head>span{font-size:44px}.store-head>div{display:grid;gap:4px;min-width:0}.store-head b{display:block;overflow-wrap:anywhere;line-height:1.45}.line-0{font-size:34px}.line-1{font-size:28px}.line-2,.line-3{font-size:22px}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #173f2b;padding-bottom:16px;margin-bottom:18px}.head h1{margin:0 0 8px;font-size:30px}.head p{margin:3px 0;color:#66736b}.period{font-weight:700;color:#173f2b}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.stat{border:1px solid #dfe7e1;border-radius:14px;padding:14px}.stat small{display:block;color:#718078;margin-bottom:7px}.stat b{font-size:19px}.table{width:100%;border-collapse:collapse}.table th,.table td{border:1px solid #dfe7e1;padding:10px;text-align:right;vertical-align:top}.table th{background:#edf5ee;color:#24553b}.table small{display:block;color:#718078;margin-top:4px}.foot{margin-top:16px;color:#718078;text-align:center;font-size:12px}@media print{body{padding:0}.sheet{max-width:none}.summary{grid-template-columns:repeat(4,1fr)}.store-head{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media(max-width:700px){.summary{grid-template-columns:1fr 1fr}.head{display:block}}</style></head><body><main class="sheet">'+statementHeader+'<header class="head"><div><h1>كشف حساب العميل</h1><p>الاسم: <b>'+esc(customer?.name||'—')+'</b></p><p>المحل: '+esc(customer?.shopName||'غير مسجل')+'</p><p>الهاتف: '+esc(customer?.phone||'—')+'</p></div><div class="period">من '+esc(from||'—')+' إلى '+esc(to||'—')+'</div></header><section class="summary"><div class="stat"><small>رصيد أول الفترة</small><b>'+esc(fmt(statement.openingBalance)+' ج.م')+'</b></div><div class="stat"><small>مبيعات الفترة</small><b>'+esc(fmt(statement.summary.sales)+' ج.م')+'</b></div><div class="stat"><small>التحصيلات</small><b>'+esc(fmt(statement.summary.paid)+' ج.م')+'</b></div><div class="stat"><small>الرصيد بعد الفترة</small><b>'+esc(fmt(statement.summary.remaining)+' ج.م')+'</b></div></section><table class="table"><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الكمية</th><th>سعر الكيلو</th><th>القيمة</th><th>الموظف</th></tr></thead><tbody>'+rows+'</tbody></table><div class="foot">تم استخراج كشف الحساب من نظام X-Store</div></main></body></html>');
  popup.document.close();popup.focus();setTimeout(()=>{try{popup.print()}catch{}},400);
}
async function buildCustomerStatementImageBlob(customer:any,statement:any,from:string,to:string,settings?:PoultryInvoiceSettings):Promise<Blob|null>{
  if(!statement)return null;
  const effectiveSettings=await resolveCustomerStatementInvoiceSettings(settings);
  const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const rows=(statement.rows||[]).map((row:any)=>'<tr>'+
    '<td>'+esc(new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date)))+'</td>'+
    '<td><b>'+esc(row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):row.type==='manual_debt'?'مديونية يدوية':'تحصيل')+'</b>'+(row.note?'<small>'+esc(row.note)+'</small>':'')+'</td>'+
    '<td>'+esc(row.items?.length?fmt(row.items.reduce((sum:any,item:any)=>sum+Number(item.quantityKg||0),0))+' كجم':'—')+'</td>'+
    '<td>'+esc(row.items?.length?fmt(row.items[0].unitPrice)+' ج.م':'—')+'</td>'+
    '<td>'+esc(fmt(row.type==='invoice'?row.total:Math.abs(row.paid||0))+' ج.م')+'</td>'+
    '<td>'+esc(row.actorName||'—')+'</td>'+
  '</tr>').join('');
  const invoiceSettings=customerStatementInvoiceSettings(effectiveSettings);
  const headerLines=invoiceSettings.showHeader?[invoiceSettings.headerStoreName,invoiceSettings.headerOwnerName,invoiceSettings.headerMessage,invoiceSettings.headerPhones].filter(line=>String(line||'').trim()):[];
  const statementHeader=headerLines.length?'<header style="display:grid;grid-template-columns:54px minmax(0,1fr) 54px;align-items:center;gap:12px;min-height:170px;padding:22px 18px;margin-bottom:18px;border-radius:24px;background:#173f2b;color:#fff;text-align:center"><span style="font-size:44px;line-height:1">🐔</span><div style="display:grid;gap:4px;min-width:0">'+headerLines.map((line,i)=>'<b style="display:block;overflow-wrap:anywhere;line-height:1.45;font-size:'+(i===0?'34px':i===1?'28px':'22px')+'">'+esc(line)+'</b>').join('')+'</div><span style="font-size:44px;line-height:1">🐔</span></header>':'';
  const width=1100;
  const height=420+Math.max(1,(statement.rows||[]).length)*78+(headerLines.length?210:0);
  const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#202522;font-family:Arial,Tahoma,sans-serif;direction:rtl}.sheet{width:100%;padding:30px;background:#fff}.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:4px solid #173f2b;padding-bottom:20px;margin-bottom:22px}.head h1{margin:0 0 10px;font-size:36px}.head p{margin:5px 0;color:#66736b;font-size:20px}.period{font-weight:800;color:#173f2b;font-size:20px;white-space:nowrap}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}.stat{border:1px solid #dfe7e1;border-radius:18px;padding:18px}.stat small{display:block;color:#718078;margin-bottom:9px;font-size:17px}.stat b{font-size:24px}.table{width:100%;border-collapse:collapse;font-size:18px}.table th,.table td{border:1px solid #dfe7e1;padding:13px;text-align:right;vertical-align:top}.table th{background:#edf5ee;color:#24553b;font-size:18px}.table small{display:block;color:#718078;margin-top:5px;line-height:1.5}.foot{margin-top:20px;color:#718078;text-align:center;font-size:14px}</style></head><body><main class="sheet">'+statementHeader+'<header class="head"><div><h1>كشف حساب العميل</h1><p>الاسم: <b>'+esc(customer?.name||'—')+'</b></p><p>المحل: '+esc(customer?.shopName||'غير مسجل')+'</p><p>الهاتف: '+esc(customer?.phone||'—')+'</p></div><div class="period">من '+esc(from||'—')+' إلى '+esc(to||'—')+'</div></header><section class="summary"><div class="stat"><small>رصيد أول الفترة</small><b>'+esc(fmt(statement.openingBalance)+' ج.م')+'</b></div><div class="stat"><small>مبيعات الفترة</small><b>'+esc(fmt(statement.summary.sales)+' ج.م')+'</b></div><div class="stat"><small>التحصيلات</small><b>'+esc(fmt(statement.summary.paid)+' ج.م')+'</b></div><div class="stat"><small>الرصيد بعد الفترة</small><b>'+esc(fmt(statement.summary.remaining)+' ج.م')+'</b></div></section><table class="table"><thead><tr><th>التاريخ والوقت</th><th>الحركة</th><th>الكمية</th><th>سعر الكيلو</th><th>القيمة</th><th>الموظف</th></tr></thead><tbody>'+rows+'</tbody></table><div class="foot">تم استخراج كشف الحساب من نظام X-Store</div></main></body></html>';
  const style=(html.match(/<style>([\s\S]*?)<\/style>/i)||[])[1]||'';
  const body=(html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||'';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><foreignObject width="'+width+'" height="'+height+'"><div xmlns="http://www.w3.org/1999/xhtml" style="width:'+width+'px;height:'+height+'px;overflow:hidden"><style>'+style+'</style>'+body+'</div></foreignObject></svg>';
  return await new Promise(resolve=>{
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})),image=new Image();
    image.onload=()=>{
      const scale=2,canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
      const ctx=canvas.getContext('2d');
      if(!ctx){URL.revokeObjectURL(url);resolve(null);return;}
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(scale,scale);ctx.drawImage(image,0,0,width,height);
      canvas.toBlob(file=>{URL.revokeObjectURL(url);resolve(file)},'image/jpeg',0.94);
    };
    image.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
}
async function shareCustomerStatement(customer:any,statement:any,from:string,to:string,settings?:PoultryInvoiceSettings){
  const file=await buildCustomerStatementImageBlob(customer,statement,from,to,settings);
  if(!file)return;
  const imageFile=new File([file],'كشف-حساب-'+String(customer?.name||'العميل')+'.jpg',{type:'image/jpeg'});
  try{
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[imageFile]}))){
      await navigator.share({files:[imageFile],title:'كشف حساب '+String(customer?.name||''),text:'كشف حساب '+String(customer?.name||'')});
      return;
    }
  }catch(e:any){if(e?.name==='AbortError')return;}
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=imageFile.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

function PoultryDashboardView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadPoultryData(query = '') {
    setLoading(true);
    try {
      const [customerData, notificationData] = await Promise.all([
        poultryApi.listCustomers(query),
        poultryApi.notifications(),
      ]);
      setCustomers(Array.isArray(customerData) ? customerData.filter(item => item && typeof item === 'object') : []);
      setNotifications(Array.isArray(notificationData) ? notificationData.filter(item => item && typeof item === 'object') : []);
    } catch {
      setCustomers([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPoultryData(); }, []);

  const totalOutstanding = customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0);
  const invoiceCount = notifications.filter(item => item.type === 'invoice').length;
  const paymentCount = notifications.filter(item => item.type === 'payment').length;
  return <div dir="rtl" className="poultry-dashboard">
    <PageTitle
      eyebrow="إدارة الدواجن والفراخ"
      title="لوحة الدواجن"
      desc="بيع بالكيلو، حسابات العملاء الآجلة، التحصيل وكشوف الحساب — بدون نظام الملابس أو نقطة بيع المنتجات التقليدية."
      action={<Link href="/poultry-customers" className="button button-primary"><Bird size={16}/> حسابات العملاء</Link>}
    />
    <div className="stat-grid">
      <StatCard label="العملاء" value={fmt(customers.length)} detail="حسابات العملاء المسجلة" icon={Users}/>
      <StatCard label="إجمالي المستحق" value={fmt(totalOutstanding) + ' ج.م'} detail="رصيد العملاء الحالي" icon={CreditCard} tint="gold"/>
      <StatCard label="فواتير حديثة" value={fmt(invoiceCount)} detail="حركة بيع بالكيلو" icon={ReceiptText}/>
      <StatCard label="تحصيلات حديثة" value={fmt(paymentCount)} detail="عمليات تحصيل مسجلة" icon={Wallet} tint="sage"/>
    </div>
    <div className="dashboard-grid">
      <Card>
        <SectionHead title="حسابات العملاء" detail="ابحث بالاسم أو الهاتف أو اسم المحل." action={<Link href="/poultry-customers" className="text-link">فتح الحسابات <ChevronLeft size={15}/></Link>}/>
        <div className="table-toolbar">
          <label className="search-box sales-search"><Search size={18}/><input value={search} onChange={e => { setSearch(e.target.value); void loadPoultryData(e.target.value); }} placeholder="اسم العميل أو الهاتف أو المحل"/></label>
        </div>
        {loading ? <div className="skeleton-table"><span/><span/><span/></div> : customers.length ? (
          <div className="poultry-dashboard-customers">
            {customers.slice(0, 8).map(customer => (
              <Link href="/poultry-customers" className="poultry-dashboard-customer" key={customer.id}>
                <span className="poultry-customer-icon"><Bird size={17}/></span>
                <span><b>{customer.name}</b><small>{customer.shopName || 'بدون اسم محل'} · {customer.phone}</small></span>
                <strong>{fmt(Number(customer.balance || 0))} ج.م</strong>
              </Link>
            ))}
          </div>
        ) : <div className="empty-inline">لا توجد حسابات عملاء حتى الآن.</div>}
      </Card>
      <Card>
        <SectionHead title="آخر الحركة" detail="الفواتير والتحصيلات التي تمت على حسابات العملاء."/>
        {notifications.length ? <div className="quick-list poultry-dashboard-activity">
          {notifications.slice(0, 6).map(item => (
            <div key={item.id}>
              <span className={"quick-icon " + (item.type === 'payment' ? 'green' : 'yellow')}>{item.type === 'payment' ? <Wallet size={17}/> : <ReceiptText size={17}/>}</span>
              <span><b>{item.title}</b><small>{item.detail}</small></span>
              <small>{dateLabel(item.createdAt)}</small>
            </div>
          ))}
        </div> : <div className="empty-inline">لا توجد حركة مسجلة بعد.</div>}
      </Card>
    </div>
    <Card className="poultry-dashboard-actions">
      <SectionHead title="إجراءات سريعة" detail="العمليات الأساسية لمتجر الدواجن."/>
      <div className="quick-list">
        <div><span className="quick-icon green"><Plus size={17}/></span><span><b>إدارة العملاء</b><small>إضافة وبحث بيانات العملاء</small></span><Link href="/poultry-customers" className="table-action">فتح</Link></div>
        <div><span className="quick-icon yellow"><ReceiptText size={17}/></span><span><b>تسجيل فاتورة بالكيلو</b><small>بيع الدواجن وحفظ سعر الكيلو</small></span><Link href="/poultry-sales" className="table-action">فتح</Link></div>
        <div><span className="quick-icon pale"><Wallet size={17}/></span><span><b>تسجيل تحصيل</b><small>تسجيل المبالغ المحصلة من العملاء</small></span><Link href="/poultry-collections" className="table-action">فتح</Link></div>
      </div>
    </Card>
  </div>;
}


export function PoultryCustomersPage({ mode, session }: { mode: 'customers' | 'sales' | 'collections'; session: SessionUser | null }) {
  return <PoultryCustomersView mode={mode} session={session}/>;
}

export function PoultryCustomerAccountPage({ session }: { session: SessionUser | null }) {
  return <PoultryCustomerAccountPageView session={session}/>;
}

export function PoultrySalePage({ session }: { session: SessionUser | null }) {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/poultry-sale/:customerId');
  const customerId = params?.customerId ? decodeURIComponent(params.customerId) : '';
  const [customer, setCustomer] = useState<PoultryCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [invoice, setInvoice] = useState({ productName: 'فراخ', quantityKg: '', unitPrice: '', deadWeightKg: '', amountPaid: '' });
  const [lastInvoice, setLastInvoice] = useState<PoultryInvoiceResult | null>(null);
  const [lastInvoiceDetails, setLastInvoiceDetails] = useState({ productName: 'فراخ', quantityKg: 0, unitPrice: 0, deadWeightKg: 0, deadTotal: 0 });
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState('0');
  const [calculatorExpression, setCalculatorExpression] = useState('0');
  const [calculatorStored, setCalculatorStored] = useState<number | null>(null);
  const [calculatorOperator, setCalculatorOperator] = useState<string | null>(null);
  const [calculatorWaiting, setCalculatorWaiting] = useState(false);
  const [calculatorTarget, setCalculatorTarget] = useState<'quantityKg' | null>(null);
  const calculatorSkipNextFocusRef = useRef(false);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const unitPriceInputRef = useRef<HTMLInputElement | null>(null);
  const deadWeightInputRef = useRef<HTMLInputElement | null>(null);
  const amountPaidInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void poultryApi.listCustomers().then(rows => {
      if (cancelled) return;
      const found = rows.find(row => row.id === customerId);
      if (!found) {
        setError('لم يتم العثور على العميل. ارجع لقائمة العملاء واختر العميل مرة أخرى.');
        setCustomer(null);
      } else {
        setCustomer(found);
      }
    }).catch(e => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات العميل.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [customerId]);

  const deadWeightKg = Math.max(0, Number(invoice.deadWeightKg) || 0);
  const deadTotal = roundMoney(deadWeightKg * (Number(invoice.unitPrice) || 0));
  const grossInvoiceTotal = roundMoney((Number(invoice.quantityKg) || 0) * (Number(invoice.unitPrice) || 0));
  const invoiceTotal = roundMoney(Math.max(0, grossInvoiceTotal - deadTotal));
  const amountReceivedToday = Math.max(0, Number(invoice.amountPaid) || 0);
  const paidOnInvoice = Math.min(invoiceTotal, amountReceivedToday);
  const extraCollection = Math.max(0, roundMoney(amountReceivedToday - invoiceTotal));
  const invoiceRemaining = Math.max(0, roundMoney(invoiceTotal - paidOnInvoice));

  function calculatorInputDigit(digit: string) {
    if (calculatorWaiting || calculatorDisplay === '0') {
      setCalculatorDisplay(digit);
      setCalculatorWaiting(false);
      setCalculatorExpression(calculatorOperator !== null && calculatorStored !== null ? String(calculatorStored) + ' ' + calculatorOperator + ' ' + digit : digit);
      return;
    }
    const next = calculatorDisplay.length >= 12 ? calculatorDisplay : calculatorDisplay + digit;
    setCalculatorDisplay(next);
    setCalculatorExpression(calculatorOperator !== null && calculatorStored !== null ? String(calculatorStored) + ' ' + calculatorOperator + ' ' + next : next);
  }

  function calculatorInputDecimal() {
    if (calculatorWaiting) {
      setCalculatorDisplay('0.');
      setCalculatorWaiting(false);
      setCalculatorExpression(calculatorOperator !== null && calculatorStored !== null ? String(calculatorStored) + ' ' + calculatorOperator + ' 0.' : '0.');
      return;
    }
    if (!calculatorDisplay.includes('.')) {
      const next = calculatorDisplay + '.';
      setCalculatorDisplay(next);
      setCalculatorExpression(calculatorOperator !== null && calculatorStored !== null ? String(calculatorStored) + ' ' + calculatorOperator + ' ' + next : next);
    }
  }

  function calculatorCalculate(a: number, b: number, op: string) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? NaN : a / b;
    return b;
  }

  function calculatorChooseOperator(op: string) {
    const current = Number(calculatorDisplay);
    if (!Number.isFinite(current)) return;
    if (calculatorOperator && calculatorStored !== null && !calculatorWaiting) {
      const result = calculatorCalculate(calculatorStored, current, calculatorOperator);
      if (!Number.isFinite(result)) {
        setCalculatorDisplay('خطأ');
        setCalculatorStored(null);
        setCalculatorOperator(null);
        setCalculatorWaiting(true);
        return;
      }
      setCalculatorStored(result);
      setCalculatorDisplay(String(Number(result.toFixed(10))));
    } else {
      setCalculatorStored(current);
    }
    setCalculatorOperator(op);
    setCalculatorExpression(String(calculatorStored ?? current) + ' ' + op);
    setCalculatorWaiting(true);
  }

  function calculatorEquals() {
    if (!calculatorOperator || calculatorStored === null) return;
    const current = Number(calculatorDisplay);
    if (!Number.isFinite(current)) return;
    const result = calculatorCalculate(calculatorStored, current, calculatorOperator);
    if (!Number.isFinite(result)) {
      setCalculatorDisplay('خطأ');
      setCalculatorExpression(String(calculatorStored) + ' ' + calculatorOperator + ' ' + calculatorDisplay + ' =');
    } else {
      const resultText = String(Number(result.toFixed(10)));
      setCalculatorDisplay(resultText);
      setCalculatorExpression(String(calculatorStored) + ' ' + calculatorOperator + ' ' + calculatorDisplay + ' =');
      if (calculatorTarget) applyCalculatorResult(resultText);
    }
    setCalculatorStored(null);
    setCalculatorOperator(null);
    setCalculatorWaiting(true);
  }

  function calculatorClear() {
    setCalculatorDisplay('0');
    setCalculatorExpression('0');
    setCalculatorStored(null);
    setCalculatorOperator(null);
    setCalculatorWaiting(false);
  }

  function calculatorBackspace() {
    if (calculatorWaiting || calculatorDisplay === 'خطأ') return calculatorClear();
    const next = calculatorDisplay.length > 1 ? calculatorDisplay.slice(0, -1) : '0';
    setCalculatorDisplay(next);
    setCalculatorExpression(calculatorOperator !== null && calculatorStored !== null ? String(calculatorStored) + ' ' + calculatorOperator + ' ' + next : next);
  }

  function openCalculatorForField(field: 'quantityKg' | 'unitPrice' | 'deadWeightKg' | 'amountPaid') {
    setCalculatorTarget(field);
    calculatorClear();
    setCalculatorOpen(true);
  }

  function applyCalculatorResult(resultOverride?: string) {
    if (!calculatorTarget) return;
    const result = Number(resultOverride ?? calculatorDisplay);
    if (!Number.isFinite(result)) return;
    const value = String(Number(result.toFixed(10)));
    setInvoice(current => ({ ...current, [calculatorTarget]: value }));
    const nextField: Record<typeof calculatorTarget, 'unitPrice' | null> = {
      quantityKg: 'unitPrice',
    };
    const nextTarget = nextField[calculatorTarget];
    setCalculatorOpen(false);
    setCalculatorTarget(null);
    if (nextTarget) {
      calculatorSkipNextFocusRef.current = true;
      setTimeout(() => {
        unitPriceInputRef.current?.focus();
      }, 0);
    }
  }

  function invoiceMessage() {
    if (!lastInvoice || !customer) return '';
    return 'فاتورة ' + lastInvoice.invoiceNo + '\n' +
      'العميل: ' + customer.name + '\n' +
      'المحل: ' + (customer.shopName || 'غير مسجل') + '\n' +
      'الهاتف: ' + customer.phone + '\n' +
      'حررها الموظف: ' + (lastInvoice.cashierName || 'غير محدد') + '\n' +
      'اليوم: ' + new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { weekday: 'long', timeZone: 'Africa/Cairo' }).format(new Date(lastInvoice.createdAt)) + '\n' +
      'القيمة: ' + fmt(lastInvoice.total) + ' ج.م\n' +
      'المدفوع على الفاتورة: ' + fmt(lastInvoice.amountPaid) + ' ج.م\n' +
      'تحصيل من الرصيد السابق: ' + fmt(lastInvoice.extraCollection || 0) + ' ج.م\n' +
      'إجمالي المدفوع اليوم: ' + fmt(lastInvoice.amountReceived ?? lastInvoice.amountPaid) + ' ج.م\n' +
      'المتبقي: ' + fmt(lastInvoice.balance) + ' ج.م\n' +
      'التاريخ والوقت: ' + new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(lastInvoice.createdAt));
  }

  function whatsappInvoice() {
    if (!lastInvoice || !customer) return;
    const raw = String(customer.phone || '').replace(/\D/g, '');
    const phone = raw.startsWith('0') ? '20' + raw.slice(1) : raw;
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(invoiceMessage()), '_blank');
  }

  function printInvoice() {
    if(!lastInvoice||!customer)return;
    buildUnifiedInvoicePrint(lastInvoice,customer,lastInvoiceDetails,session?.invoiceSettings);
  }

  function downloadInvoice() {
    if(!lastInvoice||!customer)return;
    drawUnifiedInvoiceImage(lastInvoice,customer,lastInvoiceDetails,'فاتورة-'+lastInvoice.invoiceNo+'.jpg',session?.invoiceSettings);
  }

  async function createInvoice() {
    if (!customer) return;
    const quantity = Number(invoice.quantityKg);
    const unitPrice = Number(invoice.unitPrice);
    const amountReceived = Number(invoice.amountPaid) || 0;
    if (!Number.isFinite(quantity) || quantity <= 0) { setError('اكتب كمية بالكيلو أكبر من صفر.'); return; }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) { setError('اكتب سعر الكيلو بشكل صحيح.'); return; }
    if (!Number.isFinite(amountReceived) || amountReceived < 0) { setError('اكتب المبلغ المدفوع اليوم بشكل صحيح.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await poultryApi.createInvoice(customer.id, {
        items: [{ productName: invoice.productName.trim() || 'فراخ', quantityKg: quantity, unitPrice, deadWeightKg }],
        amountPaid: amountReceived,
      });
      setLastInvoice(result);
      setLastInvoiceDetails({ productName: invoice.productName.trim() || 'فراخ', quantityKg: quantity, unitPrice, deadWeightKg, deadTotal });
      setNotice(result.extraCollection > 0
        ? 'تم تسجيل الفاتورة وتسجيل المبلغ الزائد كتحصيل من الرصيد السابق.'
        : 'تم تسجيل الفاتورة بنجاح.');
      setInvoice({ productName: 'فراخ', quantityKg: '', unitPrice: '', deadWeightKg: '', amountPaid: '' });
      const refreshed = await poultryApi.listCustomers();
      const updated = refreshed.find(row => row.id === customer.id);
      if (updated) setCustomer(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تسجيل الفاتورة.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div dir="rtl" className="poultry-sale-page"><div className="state-box"><b>جارٍ تحميل بيانات العميل…</b></div></div>;

  if (!customer) return <div dir="rtl" className="poultry-sale-page"><div className="form-error poultry-form-error"><AlertTriangle size={16}/><span>{error || 'تعذر تحميل العميل.'}</span></div><button className="button button-quiet" onClick={() => setLocation('/poultry-sales')}><ArrowLeft size={16}/> العودة لاختيار العميل</button></div>;

  return <div dir="rtl" className="poultry-sale-page">
    <PageTitle
      eyebrow="عملية بيع جديدة"
      title="استكمال بيع الدواجن"
      desc="العميل محدد بالفعل. راجع بيانات الحساب قبل تسجيل الفاتورة."
      action={<div className="poultry-sale-header-actions">
        <button className="button button-quiet" onClick={() => setLocation('/poultry-sales')}><ArrowLeft size={16}/> تغيير العميل</button>
        <button className="button button-quiet" onClick={() => setCalculatorOpen(true)}><Calculator size={16}/> الحاسبة</button>
      </div>}
    />

    
    {calculatorOpen && <div className="poultry-calculator-backdrop" onMouseDown={() => setCalculatorOpen(false)}>
      <div className="poultry-calculator" role="dialog" aria-modal="true" aria-label="الحاسبة" onMouseDown={e => e.stopPropagation()}>
        <div className="poultry-calculator-head">
          <div><span>أداة سريعة</span><h3><Calculator size={18}/> الحاسبة</h3></div>
          <button type="button" className="poultry-calculator-close" onClick={() => setCalculatorOpen(false)} aria-label="إغلاق">×</button>
        </div>
        <div className="poultry-calculator-display" dir="ltr">
          <div className="poultry-calculator-expression" aria-live="polite">{calculatorExpression}</div>
          <div className="poultry-calculator-result" aria-live="polite">{calculatorDisplay}</div>
        </div>
        <div className="poultry-calculator-grid" dir="ltr">
          <button type="button" onClick={calculatorClear} className="calc-clear">AC</button>
          <button type="button" onClick={calculatorBackspace}>⌫</button>
          <button type="button" onClick={() => calculatorChooseOperator('÷')}>÷</button>
          <button type="button" onClick={() => calculatorChooseOperator('×')}>×</button>
          {['7','8','9'].map(d => <button type="button" key={d} onClick={() => calculatorInputDigit(d)}>{d}</button>)}
          <button type="button" onClick={() => calculatorChooseOperator('-')}>−</button>
          {['4','5','6'].map(d => <button type="button" key={d} onClick={() => calculatorInputDigit(d)}>{d}</button>)}
          <button type="button" onClick={() => calculatorChooseOperator('+')}>+</button>
          {['1','2','3'].map(d => <button type="button" key={d} onClick={() => calculatorInputDigit(d)}>{d}</button>)}
          <button type="button" className="calc-equals" onClick={calculatorEquals}>=</button>
          <button type="button" onClick={() => calculatorInputDigit('0')} className="calc-zero">0</button>
          <button type="button" onClick={calculatorInputDecimal}>.</button>
        </div>
      </div>
    </div>}

    <section className="poultry-sale-identity">
      <div className="poultry-sale-identity-icon"><Users size={22}/></div>
      <div className="poultry-sale-identity-main">
        <span>بيانات الحساب قبل التسجيل</span>
        <div className="poultry-sale-identity-grid">
          <div><small>اسم العميل</small><strong>{customer.name}</strong></div>
          <div><small>صاحب المحل / اسم المحل</small><strong>{customer.shopName || 'غير مسجل'}</strong></div>
          <div><small>رقم الهاتف</small><strong dir="ltr">{customer.phone}</strong></div>
          <div><small>الرصيد الحالي</small><strong className={Number(customer.balance) > 0 ? 'poultry-balance-due' : 'poultry-balance-clear'}>{fmt(customer.balance)} ج.م</strong></div>
        </div>
      </div>
    </section>

    {error && <div className="form-error poultry-form-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
    {notice && <div className="notice-box success poultry-form-notice" role="status"><CircleCheck size={16}/><span>{notice}</span></div>}

    <div className="poultry-sale-steps">
      <div className="poultry-step is-active"><b>1</b><span>تأكيد العميل</span></div>
      <ArrowLeft size={15}/><div className="poultry-step is-active"><b>2</b><span>الكمية والسعر</span></div>
      <ArrowLeft size={15}/><div className="poultry-step"><b>3</b><span>المبلغ المدفوع</span></div>
      <ArrowLeft size={15}/><div className="poultry-step"><b>4</b><span>حفظ الفاتورة</span></div>
    </div>

    <Card className="poultry-sale-workspace">
      <div className="poultry-action-box poultry-sale-box">
        <div className="poultry-box-heading">
          <div><span className="poultry-box-kicker">تفاصيل البيع</span><h3>بيع دواجن للعميل</h3><p>اكتب الوزن وسعر الكيلو، وسيحسب النظام إجمالي الفاتورة تلقائيًا.</p></div>
          <span className="poultry-sale-badge"><Bird size={18}/> بيع بالكيلو</span>
        </div>
        <div className="form-grid poultry-sale-form">
          <label className="field"><span>الصنف</span><input value={invoice.productName} onChange={e => setInvoice({...invoice, productName: e.target.value})} placeholder="مثال: فراخ بيضاء"/></label>
          <label className="field"><span>الكمية بالكيلو <b className="required-mark">*</b></span><input ref={quantityInputRef} type="number" min="0.001" step="0.001" value={invoice.quantityKg} onFocus={() => {
            if (calculatorSkipNextFocusRef.current) {
              calculatorSkipNextFocusRef.current = false;
              return;
            }
            openCalculatorForField('quantityKg');
          }} onChange={e => setInvoice({...invoice, quantityKg: e.target.value})} placeholder="مثال: 12.500"/></label>
          <label className="field"><span>سعر الكيلو <b className="required-mark">*</b></span><input ref={unitPriceInputRef} type="number" min="0" step="0.01" value={invoice.unitPrice} onChange={e => setInvoice({...invoice, unitPrice: e.target.value})} placeholder="مثال: 145"/></label>
          <label className="field"><span>نافِق (كجم)</span><input ref={deadWeightInputRef} type="number" min="0" step="0.001" max={Number(invoice.quantityKg)||undefined} value={invoice.deadWeightKg} onChange={e => setInvoice({...invoice, deadWeightKg: e.target.value})} placeholder="مثال: 10"/></label>
          <label className="field"><span>المبلغ المدفوع اليوم</span><input ref={amountPaidInputRef} type="number" min="0" step="0.01" value={invoice.amountPaid} onChange={e => setInvoice({...invoice, amountPaid: e.target.value})} placeholder="0 = آجل بالكامل"/></label>
        </div>
        <div className="poultry-sale-calculation">
          <div><span>الوزن</span><b>{fmt(Number(invoice.quantityKg) || 0)} كجم</b></div>
          <div><span>سعر الكيلو</span><b>{fmt(Number(invoice.unitPrice) || 0)} ج.م</b></div>
          <div><span>نافِق</span><b>{fmt(deadWeightKg)} كجم · {fmt(deadTotal)} ج.م</b></div>
          <div className="total"><span>إجمالي الفاتورة</span><strong>{fmt(invoiceTotal)} ج.م</strong></div>
          <div><span>مدفوع على الفاتورة</span><b>{fmt(paidOnInvoice)} ج.م</b></div>
          <div><span>تحصيل من الرصيد السابق</span><b>{fmt(extraCollection)} ج.م</b></div>
          <div><span>متبقي هذه الفاتورة</span><b>{fmt(invoiceRemaining)} ج.م</b></div>
        </div>
        <button className="button button-primary poultry-main-action" disabled={busy || invoiceTotal <= 0} onClick={() => void createInvoice()}><ReceiptText size={17}/>{busy ? 'جارٍ تسجيل الفاتورة…' : 'تأكيد البيع وتسجيل الفاتورة'}</button>
        <small className="poultry-helper">لو المبلغ المدفوع أكبر من قيمة الفاتورة، سيتم تسجيل الزيادة تلقائيًا كتحصيل من الرصيد السابق.</small>
      </div>
    </Card>

    {lastInvoice && <section id="poultry-created-invoice" className="poultry-last-invoice">
      <PoultryInvoiceHeader settings={session?.invoiceSettings}/>
      <div className="poultry-invoice-mobile-meta">
        <div className="poultry-invoice-head">
          <div><span className="poultry-box-kicker">تم الحفظ بنجاح</span><h2>فاتورة {lastInvoice.invoiceNo}</h2></div>
          <ReceiptText size={25}/>
        </div>
        <div className="poultry-invoice-meta-grid">
          {invoiceSettingsOrDefault(session?.invoiceSettings).showCustomer&&<span><small>الاسم</small><b>{customer.name}</b></span>}
          {invoiceSettingsOrDefault(session?.invoiceSettings).showShop&&<span><small>المحل</small><b>{customer.shopName || 'غير مسجل'}</b></span>}
          {invoiceSettingsOrDefault(session?.invoiceSettings).showPhone&&<span><small>الهاتف</small><b dir="ltr">{customer.phone||'—'}</b></span>}
          {invoiceSettingsOrDefault(session?.invoiceSettings).showDateTime ? (
            <>
              <span><small>اليوم والتاريخ</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(lastInvoice.createdAt))}</b></span>
              <span><small>الوقت</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(lastInvoice.createdAt))}</b></span>
            </>
          ) : null}
          {invoiceSettingsOrDefault(session?.invoiceSettings).showCashier&&<span><small>الموظف</small><b>{lastInvoice.cashierName || 'غير محدد'}</b></span>}
        </div>
      </div>
      {(invoiceSettingsOrDefault(session?.invoiceSettings).showProduct||invoiceSettingsOrDefault(session?.invoiceSettings).showQuantity||invoiceSettingsOrDefault(session?.invoiceSettings).showUnitPrice||invoiceSettingsOrDefault(session?.invoiceSettings).showDeadWeight||invoiceSettingsOrDefault(session?.invoiceSettings).showTotal)&&<div className="poultry-invoice-sale-details">
        <span className="poultry-box-kicker">تفاصيل البيع</span>
        {invoiceSettingsOrDefault(session?.invoiceSettings).showProduct&&<div><span>الصنف</span><b>{lastInvoiceDetails.productName}</b></div>}
        {invoiceSettingsOrDefault(session?.invoiceSettings).showQuantity&&<div><span>الوزن</span><b>{fmt(lastInvoiceDetails.quantityKg)} كجم</b></div>}
        {invoiceSettingsOrDefault(session?.invoiceSettings).showUnitPrice&&<div><span>سعر الكيلو</span><b>{fmt(lastInvoiceDetails.unitPrice)} ج.م</b></div>}
        {<div><span>نافِق</span><b>{fmt(lastInvoiceDetails.deadWeightKg)} كجم · {fmt(lastInvoiceDetails.deadTotal)} ج.م</b></div>}
        {invoiceSettingsOrDefault(session?.invoiceSettings).showTotal&&<div className="sale-total"><span>إجمالي البيع</span><strong>{fmt(lastInvoice.total)} ج.م</strong></div>}
      </div>}
      {(invoiceSettingsOrDefault(session?.invoiceSettings).showPaid||invoiceSettingsOrDefault(session?.invoiceSettings).showExtraCollection||invoiceSettingsOrDefault(session?.invoiceSettings).showBalance)&&<div className="poultry-invoice-totals">
        {invoiceSettingsOrDefault(session?.invoiceSettings).showPaid&&<div><span>المدفوع</span><b>{fmt(lastInvoice.amountPaid)} ج.م</b></div>}
        {invoiceSettingsOrDefault(session?.invoiceSettings).showExtraCollection&&<div><span>التحصيل من الرصيد السابق</span><b>{fmt(lastInvoice.extraCollection || 0)} ج.م</b></div>}
        {invoiceSettingsOrDefault(session?.invoiceSettings).showBalance&&<div className="total"><span>المتبقي</span><strong>{fmt(lastInvoice.balance)} ج.م</strong></div>}
      </div>}
      <div className="poultry-invoice-actions">
        <button className="button button-quiet poultry-invoice-exit" onClick={() => setLocation('/poultry-sales')}>خروج</button>
        <button className="button button-primary" onClick={() => setLocation('/poultry-sale/' + encodeURIComponent(customer.id))}><ReceiptText size={16}/> فتح صفحة بيع العميل</button>
        <button className="button button-quiet" onClick={printInvoice}><Printer size={16}/> طباعة</button>
        <button className="button button-quiet" onClick={downloadInvoice}><Download size={16}/> حفظ كصورة</button>
        <button className="button button-quiet" onClick={()=>shareUnifiedInvoiceImage(lastInvoice,customer,lastInvoiceDetails,session?.invoiceSettings)}><Share2 size={16}/> مشاركة</button>
        <button className="button button-quiet" onClick={whatsappInvoice}><MessageCircle size={16}/> إرسال واتساب</button>
      </div>
    </section>}


  </div>;
}

export function PoultryInvoicesPage({ session }: { session: SessionUser | null }) {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<Awaited<ReturnType<typeof poultryApi.listInvoices>> | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await poultryApi.listInvoices(from, to, search));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الفواتير.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const invoices = data?.invoices || [];

  async function downloadInvoiceImage(invoice: Awaited<ReturnType<typeof poultryApi.listInvoices>>['invoices'][number]) {
    await drawUnifiedInvoiceImage(invoice,{name:invoice.customerName,shopName:invoice.shopName,phone:invoice.phone},invoice.items?.[0],'فاتورة-'+invoice.invoiceNo+'.jpg',session?.invoiceSettings);
  }

  async function shareInvoice(invoice: Awaited<ReturnType<typeof poultryApi.listInvoices>>['invoices'][number]) {
    await shareUnifiedInvoiceImage(invoice,{name:invoice.customerName,shopName:invoice.shopName,phone:invoice.phone},invoice.items?.[0],session?.invoiceSettings);
  }

  function whatsappInvoice(invoice: Awaited<ReturnType<typeof poultryApi.listInvoices>>['invoices'][number]) {
    const phone = String(invoice.phone || '').replace(/\D/g, '');
    if (!phone) {
      window.alert('رقم هاتف العميل غير مسجل.');
      return;
    }
    const text = [
      'فاتورة ' + invoice.invoiceNo,
      'العميل: ' + invoice.customerName,
      'المحل: ' + (invoice.shopName || 'غير مسجل'),
      'الصنف: ' + (invoice.items[0]?.productName || '—'),
      'الوزن: ' + fmt(invoice.items.reduce((sum, item) => sum + Number(item.quantityKg || 0), 0)) + ' كجم',
      'سعر الكيلو: ' + fmt(invoice.items[0]?.unitPrice || 0) + ' ج.م',
      'النافِق: ' + fmt(invoice.items.reduce((sum, item) => sum + Number(item.deadWeightKg || 0), 0)) + ' كجم · ' + fmt(invoice.items.reduce((sum, item) => sum + Number(item.deadTotal || 0), 0)) + ' ج.م',
      'إجمالي البيع: ' + fmt(invoice.total) + ' ج.م',
      'المدفوع: ' + fmt(invoice.amountPaid) + ' ج.م',
      'تحصيل من الرصيد السابق: ' + fmt(invoice.extraCollection || 0) + ' ج.م',
      'المتبقي: ' + fmt(invoice.balance) + ' ج.م',
      'التاريخ والوقت: ' + new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(invoice.date))
    ].join('\n');
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(text), '_blank');
  }

  function printInvoice(invoice: Awaited<ReturnType<typeof poultryApi.listInvoices>>['invoices'][number]) {
    buildUnifiedInvoicePrint(invoice,{name:invoice.customerName,shopName:invoice.shopName,phone:invoice.phone},invoice.items?.[0],session?.invoiceSettings);
  }

  return <div dir="rtl" className="poultry-invoices-page">
    <PageTitle
      eyebrow="إدارة الفواتير"
      title="فواتير الدواجن"
      desc="كل الفواتير المسجلة في متجر الدواجن، مع بيانات العميل والوزن والسعر والمدفوع والمتبقي."
      action={<div className="poultry-header-actions"><button className="button button-quiet" onClick={() => window.print()}><Printer size={16}/> طباعة</button></div>}
    />

    <div className="poultry-invoice-stats">
      <StatCard label="عدد الفواتير" value={fmt(data?.summary.count || 0)} detail="الفواتير الظاهرة" icon={ReceiptText}/>
      <StatCard label="إجمالي المبيعات" value={fmt(data?.summary.sales || 0) + ' ج.م'} detail="قيمة الفواتير" icon={CreditCard} tint="gold"/>      <StatCard label="إجمالي المدفوع" value={fmt(data?.summary.paid || 0) + ' ج.م'} detail="يشمل التحصيل المرتبط" icon={Wallet}/>
      <StatCard label="إجمالي الكمية" value={fmt(data?.summary.totalKg || 0) + ' كجم'} detail="وزن الأصناف المباعة" icon={Bird} tint="green"/>
    </div>

    <Card className="poultry-invoices-filter">
      <SectionHead title="البحث والتصفية" detail="ابحث برقم الفاتورة أو اسم العميل أو المحل أو الهاتف."/>
      <div className="poultry-invoice-filter-grid">
        <label className="search-box poultry-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void load(); }} placeholder="رقم الفاتورة أو اسم العميل أو الهاتف"/></label>
        <label className="field"><span>من تاريخ</span><input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label>
        <label className="field"><span>إلى تاريخ</span><input type="date" value={to} onChange={e => setTo(e.target.value)}/></label>
        <button className="button button-primary poultry-invoice-filter-button" onClick={() => void load()} disabled={loading}><Search size={16}/> تطبيق البحث</button>
      </div>
    </Card>

    {error && <div className="form-error poultry-form-error"><AlertTriangle size={16}/><span>{error}</span><button className="button button-quiet" onClick={() => void load()}>إعادة المحاولة</button></div>}

    <Card className="poultry-invoices-card">
      <SectionHead title="سجل الفواتير" detail={loading ? 'جارٍ تحميل الفواتير…' : invoices.length ? `عدد الفواتير: ${fmt(invoices.length)}` : 'لا توجد فواتير في الفترة المحددة'}/>
      {loading ? <div className="skeleton-table"><span/><span/><span/></div> : invoices.length ? <div className="poultry-invoice-list">
        {invoices.map(invoice => {
          const isOpen = expanded === invoice.id;
          return <article className={'poultry-invoice-card ' + (isOpen ? 'is-open' : '')} key={invoice.id}>
            <button type="button" className="poultry-invoice-card-main" onClick={() => setExpanded(isOpen ? null : invoice.id)}>
              <div className="poultry-invoice-number"><span>فاتورة</span><strong>{invoice.invoiceNo}</strong></div>
              <div className="poultry-invoice-customer"><b>{invoice.customerName}</b><small>{invoice.shopName || 'بدون اسم محل'} · {invoice.phone}</small></div>
              <div className="poultry-invoice-date"><small>التاريخ</small><b>{dateLabel(invoice.date)}</b><span>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(invoice.date))}</span></div>
              <div className="poultry-invoice-money"><small>الإجمالي</small><strong>{fmt(invoice.total)} ج.م</strong></div>
              <div className="poultry-invoice-status"><span className={invoice.balance > 0 ? 'due' : 'paid'}>{invoice.balance > 0 ? 'آجل' : 'مدفوعة'}</span><small>{invoice.balance > 0 ? 'متبقي '+fmt(invoice.balance)+' ج.م' : 'تم السداد'}</small></div>
              <div className="poultry-invoice-chevron">{isOpen ? '−' : '+'}</div>
            </button>
            {isOpen && <div className="poultry-invoice-details">
              <PoultryInvoiceHeader settings={session?.invoiceSettings}/>
              <div className="poultry-invoice-mobile-meta">
                <div className="poultry-invoice-head">
                  <div><span className="poultry-box-kicker">تم الحفظ بنجاح</span><h2>فاتورة {invoice.invoiceNo}</h2></div>
                  <ReceiptText size={25}/>
                </div>
                <div className="poultry-invoice-meta-grid">
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showCustomer&&<span><small>الاسم</small><b>{invoice.customerName}</b></span>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showShop&&<span><small>المحل</small><b>{invoice.shopName || 'غير مسجل'}</b></span>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showPhone&&<span><small>الهاتف</small><b dir="ltr">{invoice.phone||'—'}</b></span>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showDateTime&&<span><small>اليوم والتاريخ</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(invoice.date))}</b></span>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showDateTime&&<span><small>الوقت</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(invoice.date))}</b></span>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showCashier&&<span><small>الموظف</small><b>{invoice.cashierName || 'غير محدد'}</b></span>}
                </div>
              </div>
              {(invoiceSettingsOrDefault(session?.invoiceSettings).showProduct||invoiceSettingsOrDefault(session?.invoiceSettings).showQuantity||invoiceSettingsOrDefault(session?.invoiceSettings).showUnitPrice||invoiceSettingsOrDefault(session?.invoiceSettings).showDeadWeight||invoiceSettingsOrDefault(session?.invoiceSettings).showTotal)&&<div className="poultry-invoice-sale-details">
                <span className="poultry-box-kicker">تفاصيل البيع</span>
                {invoice.items.map((item,index)=><div key={invoice.id+'-'+index}>
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showProduct&&<><span>الصنف</span><b>{item.productName||'—'}</b></>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showQuantity&&<><span>الوزن</span><b>{fmt(Number(item.quantityKg)||0)} كجم</b></>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showUnitPrice&&<><span>سعر الكيلو</span><b>{fmt(Number(item.unitPrice)||0)} ج.م</b></>}
                  {<><span>نافِق</span><b>{fmt(Number(item.deadWeightKg)||0)} كجم · {fmt(Number(item.deadTotal)||0)} ج.م</b></>}
                  {invoiceSettingsOrDefault(session?.invoiceSettings).showTotal&&<div className="sale-total"><span>إجمالي البيع</span><strong>{fmt(Number(item.total)||0)} ج.م</strong></div>}
                </div>)}
              </div>}
              {(invoiceSettingsOrDefault(session?.invoiceSettings).showPaid||invoiceSettingsOrDefault(session?.invoiceSettings).showExtraCollection||invoiceSettingsOrDefault(session?.invoiceSettings).showBalance)&&<div className="poultry-invoice-totals">
                {invoiceSettingsOrDefault(session?.invoiceSettings).showPaid&&<div><span>المدفوع</span><b>{fmt(invoice.amountPaid)} ج.م</b></div>}
                {invoiceSettingsOrDefault(session?.invoiceSettings).showExtraCollection&&<div><span>التحصيل من الرصيد السابق</span><b>{fmt(invoice.extraCollection||0)} ج.م</b></div>}
                {invoiceSettingsOrDefault(session?.invoiceSettings).showBalance&&<div className="total"><span>المتبقي</span><strong>{fmt(invoice.balance)} ج.م</strong></div>}
              </div>}
              <div className="poultry-invoice-actions">
                <button className="button button-quiet poultry-invoice-exit" onClick={() => setExpanded(null)}>خروج</button>
                <button className="button button-primary" onClick={() => setLocation('/poultry-sale/'+encodeURIComponent(invoice.customerId))}><ReceiptText size={16}/> فتح صفحة بيع العميل</button>
                <button className="button button-quiet" onClick={() => printInvoice(invoice)}><Printer size={16}/> طباعة</button>
                <button className="button button-quiet" onClick={() => downloadInvoiceImage(invoice)}><Download size={16}/> حفظ كصورة</button>
                <button className="button button-quiet" onClick={() => shareInvoice(invoice)}><Share2 size={16}/> مشاركة</button>
                <button className="button button-quiet" onClick={() => whatsappInvoice(invoice)}><MessageCircle size={16}/> إرسال واتساب</button>
              </div>
            </div>}
          </article>;
        })}
      </div> : <div className="poultry-empty-workspace"><ReceiptText size={36}/><h3>لا توجد فواتير</h3><p>عند تسجيل أول فاتورة دواجن ستظهر هنا تلقائيًا بشكل مرتب وقابل للبحث والطباعة.</p></div>}
    </Card>
  </div>;
}

export function PoultryDashboardPage() {
  return <PoultryDashboardView/>;
}

// Production deployment trigger: keep accumulated poultry updates deployable.