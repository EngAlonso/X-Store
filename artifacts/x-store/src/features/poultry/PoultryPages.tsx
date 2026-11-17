import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  AlertTriangle, ArrowLeft, Bird, Boxes, ChevronLeft, CircleCheck, CreditCard,
  Download, MessageCircle, Plus, Printer, ReceiptText, Search, ShieldCheck, Users, Wallet,
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

function drawUnifiedInvoiceImage(invoice:any,customer:any,details:any,filename:string,settings?:PoultryInvoiceSettings){
  const s=invoiceSettingsOrDefault(settings),item=details||invoice.items?.[0]||{},rows:Array<[string,string]>=[],totals:Array<[string,string]>=[],width=1200;
  if(s.showCustomer)rows.push(['العميل',customer?.name||invoice.customerName||'—']);if(s.showShop)rows.push(['المحل',customer?.shopName||invoice.shopName||'غير مسجل']);if(s.showPhone)rows.push(['الهاتف',customer?.phone||invoice.phone||'—']);if(s.showCashier)rows.push(['الموظف',invoice.cashierName||'غير محدد']);
  if(s.showProduct)rows.push(['الصنف',item.productName||'فراخ']);if(s.showQuantity)rows.push(['الوزن',fmt(Number(item.quantityKg)||0)+' كجم']);if(s.showUnitPrice)rows.push(['سعر الكيلو',fmt(Number(item.unitPrice)||0)+' ج.م']);if(s.showDeadWeight)rows.push(['نافِق',fmt(Number(item.deadWeightKg)||0)+' كجم · '+fmt(Number(item.deadTotal)||0)+' ج.م']);if(s.showTotal)rows.push(['إجمالي البيع',fmt(Number(invoice.total)||0)+' ج.م']);if(s.showDateTime)rows.push(['التاريخ والوقت',new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(invoice.createdAt||invoice.date))]);
  if(s.showPaid)totals.push(['المدفوع',fmt(Number(invoice.amountPaid)||0)+' ج.م']);if(s.showExtraCollection)totals.push(['تحصيل من الرصيد السابق',fmt(Number(invoice.extraCollection)||0)+' ج.م']);if(s.showBalance)totals.push(['المتبقي',fmt(Number(invoice.balance)||0)+' ج.م']);
  const lines=s.showHeader?[s.headerStoreName,s.headerOwnerName,s.headerMessage,s.headerPhones].filter(Boolean):[],headerH=lines.length?260:190,totalRows=Math.max(1,Math.ceil(rows.length/2)),height=headerH+70+totalRows*92+Math.max(1,Math.ceil(totals.length/3))*125+90;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#f1f5f2';ctx.fillRect(0,0,width,height);
  const card=(x:number,y:number,w:number,h:number,fill='#fff')=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)},txt=(v:string,x:number,y:number,sz:number,w='600',col='#17251b')=>{ctx.fillStyle=col;ctx.font=w+' '+sz+'px Arial';ctx.fillText(v,x,y)};
  card(0,0,width,headerH,'#173f2b');if(lines.length){txt('🐔',width-70,58,36,'800','#fff');txt('🐔',70,58,36,'800','#fff');lines.forEach((line,i)=>txt(line,width/2,55+i*42,i===0?30:i===1?23:19,i<2?'800':'600','#fff'));}else txt('فاتورة دواجن',width-70,58,34,'800','#fff');
  const x=55,w=width-110;txt('فاتورة '+invoice.invoiceNo,width-70,headerH-70,36,'800','#fff');card(x,headerH+20,w,totalRows*92+50);txt('تفاصيل الفاتورة',width-80,headerH+52,18,'800','#718078');
  rows.forEach((r,i)=>{const cellW=(w-20)/2,col=i%2,row=Math.floor(i/2),cx=col===0?x+10:x+10+cellW,cy=headerH+72+row*92;card(cx,cy,cellW-10,78);txt(r[0],cx+cellW-28,cy+25,14,'700','#718078');txt(r[1],cx+cellW-28,cy+54,20,'800')});
  let y=headerH+totalRows*92+80;if(totals.length){const cellW=(w-20)/Math.min(3,totals.length);totals.forEach((r,i)=>{const cx=x+10+i*cellW,isLast=i===totals.length-1&&s.showBalance;card(cx,y,cellW-10,105,isLast?'#173f2b':'#fff');txt(r[0],cx+cellW-28,y+32,14,'700',isLast?'#d8e5da':'#718078');txt(r[1],cx+cellW-28,y+72,24,'800',isLast?'#fff':'#17251b');});y+=120;}card(x,y,w,68,'#edf5ee');txt('X-Store · فاتورة دواجن',width-80,y+43,18,'700','#24553b');
  canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/jpeg',0.92);
}
function buildUnifiedInvoicePrint(invoice:any,customer:any,details:any,settings?:PoultryInvoiceSettings){
  const s=invoiceSettingsOrDefault(settings),esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c)),d=new Date(invoice.createdAt||invoice.date),dateText=new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Cairo'}).format(d),timeText=new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(d),item=details||invoice.items?.[0]||{};
  const field=(l:string,v:string)=>'<div class="field"><small>'+esc(l)+'</small><b>'+esc(v)+'</b></div>',fields=[s.showCustomer?field('العميل',customer?.name||invoice.customerName||'—'):'',s.showShop?field('المحل',customer?.shopName||invoice.shopName||'غير مسجل'):'',s.showPhone?field('الهاتف',customer?.phone||invoice.phone||'—'):'',s.showCashier?field('الموظف',invoice.cashierName||'غير محدد'):'',s.showProduct?field('الصنف',item.productName||'فراخ'):'',s.showQuantity?field('الوزن',fmt(Number(item.quantityKg)||0)+' كجم'):'',s.showUnitPrice?field('سعر الكيلو',fmt(Number(item.unitPrice)||0)+' ج.م'):'',s.showDeadWeight?field('نافِق',fmt(Number(item.deadWeightKg)||0)+' كجم · '+fmt(Number(item.deadTotal)||0)+' ج.م'):'',s.showTotal?field('إجمالي البيع',fmt(Number(invoice.total)||0)+' ج.م'):'',s.showDateTime?field('التاريخ والوقت',dateText+' · '+timeText):''].filter(Boolean).join('');
  const totals=[s.showPaid?'<div class="total"><small>المدفوع</small><b>'+esc(fmt(Number(invoice.amountPaid)||0)+' ج.م')+'</b></div>':'',s.showExtraCollection?'<div class="total"><small>تحصيل من الرصيد السابق</small><b>'+esc(fmt(Number(invoice.extraCollection)||0)+' ج.م')+'</b></div>':'',s.showBalance?'<div class="total remaining"><small>المتبقي</small><strong>'+esc(fmt(Number(invoice.balance)||0)+' ج.م')+'</strong></div>':''].filter(Boolean).join('');
  const lines=s.showHeader?[s.headerStoreName,s.headerOwnerName,s.headerMessage,s.headerPhones].filter(Boolean):[],header=lines.length?'<section class="card header"><div class="birds"><span>🐔</span><div>'+lines.map((line,i)=>'<b class="l'+i+'">'+esc(line)+'</b>').join('')+'</div><span>🐔</span></div></section>':'';
  const popup=window.open('','_blank','width=900,height=1000');if(!popup)return;popup.document.open();popup.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فاتورة '+esc(invoice.invoiceNo)+'</title><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f1f5f2;color:#17251b;font-family:Arial,Tahoma,sans-serif;direction:rtl}body{padding:18px}.receipt{width:100%;max-width:620px;margin:auto}.card{background:#fff;border:1px solid #dfe7e1;border-radius:16px;padding:14px;margin-bottom:12px}.header{background:#173f2b;color:#fff;border:0}.birds{display:grid;grid-template-columns:40px 1fr 40px;align-items:center;gap:8px;text-align:center}.birds>span{font-size:28px}.birds b{display:block;margin:3px 0}.birds .l0{font-size:22px}.birds .l1{font-size:18px}.birds .l2,.birds .l3{font-size:14px;font-weight:600}.section{font-size:12px;color:#718078;font-weight:800;margin-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{border:1px solid #e2eae3;border-radius:10px;padding:9px;min-width:0}.field small{display:block;color:#718078;font-size:10px;margin-bottom:4px}.field b{display:block;font-size:13px;overflow-wrap:anywhere}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.total{border:1px solid #e2eae3;border-radius:10px;padding:10px}.total small{display:block;color:#718078;font-size:10px;margin-bottom:5px}.total b,.total strong{font-size:14px}.remaining{background:#173f2b;color:#fff;border-color:#173f2b}.remaining small{color:#d8e5da}.foot{text-align:center;color:#718078;font-size:10px}@media print{html,body{background:#fff}body{padding:0}.receipt{max-width:none}.card{break-inside:avoid}.header,.remaining{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><main class="receipt">'+header+'<section class="card"><div class="section">تفاصيل الفاتورة</div><div class="grid">'+fields+'</div></section>'+(totals?'<section class="card"><div class="totals">'+totals+'</div></section>':'')+'<div class="foot">تم استخراج الفاتورة من نظام X-Store</div></main></body></html>');popup.document.close();popup.focus();setTimeout(()=>{try{popup.print()}catch{}},500);
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
  const [newCustomer,setNewCustomer]=useState({name:'',phone:'',shopName:'',shopAddress:''});
  const [invoice,setInvoice]=useState({productName:'فراخ',quantityKg:'',unitPrice:'',deadWeightKg:'',amountPaid:''});
  const [payment,setPayment]=useState('');
  const [lastInvoice,setLastInvoice]=useState<PoultryInvoiceResult|null>(null);

  const pageMode=mode;
  const canAddCustomer=pageMode==='customers' && hasAppRole(session,['tenant_admin','cashier','customer_management']);
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
    if(!payload.name||!payload.phone){
      setError('اكتب اسم العميل ورقم الهاتف قبل الحفظ.');
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

  async function loadStatement(customer=selected){
    if(!customer)return;
    setBusy(true);setError('');
    try{
      const result = await poultryApi.getStatement(customer.id, from, to);
      setStatement(result);
    }catch(e){setError(e instanceof Error?e.message:'تعذر تحميل كشف الحساب.');}
    finally{setBusy(false);}
  }

  const invoiceTotal=roundMoney((Number(invoice.quantityKg)||0)*(Number(invoice.unitPrice)||0));
  const amountReceivedToday=Math.max(0,Number(invoice.amountPaid)||0);
  const paidOnInvoice=Math.min(invoiceTotal,amountReceivedToday);
  const extraCollection=Math.max(0,roundMoney(amountReceivedToday-invoiceTotal));
  const invoiceRemaining=Math.max(0,roundMoney(invoiceTotal-paidOnInvoice));
  const deadWeightKg=Math.max(0,Number(invoice.deadWeightKg)||0);
  const deadTotal=roundMoney(deadWeightKg*(Number(invoice.unitPrice)||0));

  async function createInvoice(){
    if(!selected){setError('اختَر العميل أولاً.');return;}
    const quantity=Number(invoice.quantityKg);
    const unitPrice=Number(invoice.unitPrice);
    const amountReceived=Number(invoice.amountPaid)||0;
    if(!Number.isFinite(quantity)||quantity<=0){setError('اكتب كمية بالكيلو أكبر من صفر.');return;}
    if(!Number.isFinite(unitPrice)||unitPrice<0){setError('اكتب سعر الكيلو بشكل صحيح.');return;}
    if(!Number.isFinite(amountReceived)||amountReceived<0){setError('اكتب المبلغ المدفوع اليوم بشكل صحيح.');return;}
    const total=roundMoney(quantity*unitPrice);
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

  function downloadStatement(){
    if(!selected||!statement)return;
    const rows=statement.rows,width=1200,rowHeight=205,height=620+Math.max(rows.length,1)*rowHeight,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)return;ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#f1f5f2';ctx.fillRect(0,0,width,height);
    const card=(x:number,y:number,w:number,h:number,fill='#fff')=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)},txt=(v:string,x:number,y:number,s:number,w='600',c='#17251b')=>{ctx.fillStyle=c;ctx.font=w+' '+s+'px Arial';ctx.fillText(v,x,y)},wrap=(v:string,x:number,y:number,max:number,s:number,w='600',c='#17251b')=>{ctx.fillStyle=c;ctx.font=w+' '+s+'px Arial';let line='',yy=y;for(const word of String(v).split(' ')){const t=line?line+' '+word:word;if(ctx.measureText(t).width>max&&line){ctx.fillText(line,x,yy);line=word;yy+=s+7}else line=t}if(line)ctx.fillText(line,x,yy)};
    card(0,0,width,190,'#173f2b');txt('كشف حساب عميل',width-60,70,42,'800','#fff');txt(selected.name,width-60,112,25,'800','#fff');txt('الفترة: '+from+' إلى '+to,width-60,150,20,'600','#fff');
    const x=55,w=width-110;card(x,215,w,145);txt('بيانات الحساب',width-80,250,18,'800','#718078');txt('المحل: '+(selected.shopName||'—'),width-80,285,21,'700');txt('الهاتف: '+selected.phone,width-80,320,21,'700');txt('رصيد أول الفترة: '+fmt(statement.openingBalance)+' ج.م',width-80,348,21,'700');
    let y=385;rows.forEach((row:any)=>{card(x,y,w,rowHeight-15);txt(row.type==='invoice'?'فاتورة '+(row.invoiceNo||''):'تحصيل',width-80,y+35,22,'800',row.type==='payment'?'#24553b':'#17251b');const date=new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(row.date));const qty=row.items?.length?fmt(row.items.reduce((s:number,i:any)=>s+Number(i.quantityKg||0),0))+' كجم':'—';const price=row.items?.length?fmt(row.items[0].unitPrice)+' ج.م':'—';const value=fmt(row.type==='invoice'?row.total:row.paid)+' ج.م';const fields=[['التاريخ والوقت',date],['الكيلو',qty],['سعر الكيلو',price],['القيمة',value],['الموظف',row.actorName||'—']];fields.forEach((f,i)=>wrap(f[0]+' : '+f[1],width-80-(i%2)*540,y+65+Math.floor(i/2)*55,500,17,'700'));if(row.type==='payment'&&row.note)wrap('ملاحظة: '+row.note,width-80,y+170,1040,16,'600','#63746a');y+=rowHeight});
    y+=8;[['إجمالي الكمية',fmt(statement.summary.totalKg)+' كجم'],['المبيعات',fmt(statement.summary.sales)+' ج.م'],['التحصيلات',fmt(statement.summary.paid)+' ج.م'],['الرصيد المتبقي',fmt(statement.summary.remaining)+' ج.م']].forEach((f,i)=>{const bx=x+(i%2)*540,by=y+Math.floor(i/2)*95;card(bx,by,500,78,i===3?'#173f2b':'#fff');txt(f[0],bx+478,by+29,17,'700',i===3?'#d8e5da':'#718078');txt(f[1],bx+478,by+61,24,'800',i===3?'#fff':'#17251b')});
    canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='كشف-حساب-'+selected.name+'-'+from+'-'+to+'.jpg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/jpeg',0.92);
  }

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
    {error&&<div className="form-error poultry-form-error" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
    {notice&&<div className="notice-box success poultry-form-notice"><CircleCheck size={16}/><span>{notice}</span></div>}

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
          {customers.length?customers.map(c=><button type="button" className={'poultry-customer '+(selected?.id===c.id?'selected':'')} key={c.id} onClick={()=>{if(pageMode==='sales'){setLocation('/poultry-sale/'+encodeURIComponent(c.id));return;}setSelected(c);setStatement(null);setError('');}}>
            <span className="poultry-customer-icon"><Bird size={18}/></span>
            <span><b>{c.name}</b><small>{c.shopName||'بدون اسم محل'} · {c.phone}</small></span>
            <strong>{fmt(c.balance)} ج.م</strong>
          </button>):<div className="state-box"><div className="empty-symbol"><Bird size={22}/></div><b>لا يوجد عملاء</b><span>ابدأ بزر «عميل جديد» وأضف أول حساب.</span></div>}
        </div>
      </Card>

      <Card className="poultry-workspace-card">
        {selected?<>
          <SectionHead title={'حساب '+selected.name} detail={(selected.shopName||'بدون اسم محل')+' · '+selected.phone}/>
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
            <div className="form-actions"><button className="button button-primary" onClick={()=>void loadStatement()} disabled={busy}><ReceiptText size={16}/> عرض كشف الحساب</button>{statement&&<><button className="button button-quiet" onClick={whatsappStatement}><MessageCircle size={16}/> واتساب</button><button className="button button-quiet" onClick={printStatement}><Printer size={16}/> طباعة / PDF</button><button className="button button-quiet" onClick={downloadStatement}><Download size={16}/> تنزيل كشف الحساب JPG</button></>}</div>
          </div>}

          {pageMode==='sales'&&lastInvoice&&<div className="notice-box success poultry-last-invoice"><b>آخر فاتورة: {lastInvoice.invoiceNo}</b><span>القيمة {fmt(lastInvoice.total)} ج.م · المدفوع على الفاتورة {fmt(lastInvoice.amountPaid)} ج.م · تحصيل من الرصيد السابق {fmt(lastInvoice.extraCollection||0)} ج.م · المتبقي من الفاتورة {fmt(lastInvoice.balance)} ج.م</span><div className="form-actions"><button className="button button-quiet" onClick={whatsappInvoice}><MessageCircle size={16}/> إرسال الفاتورة واتساب</button><button className="button button-quiet" onClick={()=>window.print()}><Printer size={16}/> طباعة / PDF</button></div></div>}
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

    {pageMode==='customers'&&customerDialog&&<Modal title="إضافة عميل دواجن" close={()=>{if(!busy)setCustomerDialog(false);}}>
      <form className="poultry-customer-form" onSubmit={e=>{e.preventDefault();void createCustomer();}}>
        <div className="poultry-modal-intro"><div className="poultry-modal-icon"><Bird size={22}/></div><div><b>بيانات العميل الأساسية</b><span>الاسم ورقم الهاتف مطلوبان. بيانات المحل اختيارية.</span></div></div>
        <div className="form-grid">
          <label className="field field-wide"><span>اسم العميل <b className="required-mark">*</b></span><input autoFocus value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer,name:e.target.value})} placeholder="مثال: أحمد محمد"/></label>
          <label className="field"><span>رقم الهاتف <b className="required-mark">*</b></span><input type="tel" inputMode="tel" value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})} placeholder="01xxxxxxxxx"/></label>
          <label className="field"><span>اسم المحل</span><input value={newCustomer.shopName} onChange={e=>setNewCustomer({...newCustomer,shopName:e.target.value})} placeholder="مثال: محل البركة"/></label>
          <label className="field field-wide"><span>عنوان المحل</span><input value={newCustomer.shopAddress} onChange={e=>setNewCustomer({...newCustomer,shopAddress:e.target.value})} placeholder="المنطقة / الشارع"/></label>
        </div>
        <div className="poultry-form-explain"><ShieldCheck size={16}/><span>بعد الحفظ هتقدر تختار العميل فورًا وتسجل له البيع بالكيلو أو التحصيل.</span></div>
        <div className="modal-actions"><button className="button button-quiet" type="button" onClick={()=>setCustomerDialog(false)} disabled={busy}>إلغاء</button><button className="button button-primary" type="submit" disabled={busy||!newCustomer.name.trim()||!newCustomer.phone.trim()}><Plus size={16}/>{busy?'جارٍ إضافة العميل…':'حفظ العميل'}</button></div>
      </form>
    </Modal>}
  </div>;
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

  const invoiceTotal = roundMoney((Number(invoice.quantityKg) || 0) * (Number(invoice.unitPrice) || 0));
  const amountReceivedToday = Math.max(0, Number(invoice.amountPaid) || 0);
  const paidOnInvoice = Math.min(invoiceTotal, amountReceivedToday);
  const extraCollection = Math.max(0, roundMoney(amountReceivedToday - invoiceTotal));
  const invoiceRemaining = Math.max(0, roundMoney(invoiceTotal - paidOnInvoice));
  const deadWeightKg = Math.max(0, Number(invoice.deadWeightKg) || 0);
  const deadTotal = roundMoney(deadWeightKg * (Number(invoice.unitPrice) || 0));

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
      action={<button className="button button-quiet" onClick={() => setLocation('/poultry-sales')}><ArrowLeft size={16}/> تغيير العميل</button>}
    />

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
          <label className="field"><span>الكمية بالكيلو <b className="required-mark">*</b></span><input type="number" min="0.001" step="0.001" value={invoice.quantityKg} onChange={e => setInvoice({...invoice, quantityKg: e.target.value})} placeholder="مثال: 12.500"/></label>
          <label className="field"><span>سعر الكيلو <b className="required-mark">*</b></span><input type="number" min="0" step="0.01" value={invoice.unitPrice} onChange={e => setInvoice({...invoice, unitPrice: e.target.value})} placeholder="مثال: 145"/></label>
          <label className="field"><span>نافِق (كجم)</span><input type="number" min="0" step="0.001" max={Number(invoice.quantityKg)||undefined} value={invoice.deadWeightKg} onChange={e => setInvoice({...invoice, deadWeightKg: e.target.value})} placeholder="مثال: 10"/></label>
          <label className="field"><span>المبلغ المدفوع اليوم</span><input type="number" min="0" step="0.01" value={invoice.amountPaid} onChange={e => setInvoice({...invoice, amountPaid: e.target.value})} placeholder="0 = آجل بالكامل"/></label>
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
      <div className="poultry-invoice-mobile-meta">
        <div className="poultry-invoice-head">
          <div><span className="poultry-box-kicker">تم الحفظ بنجاح</span><h2>فاتورة {lastInvoice.invoiceNo}</h2></div>
          <ReceiptText size={25}/>
        </div>
        <div className="poultry-invoice-meta-grid">
          <span><small>العميل</small><b>{customer.name}</b></span>
          <span><small>المحل</small><b>{customer.shopName || 'غير مسجل'}</b></span>
          <span><small>الهاتف</small><b dir="ltr">{customer.phone}</b></span>
          <span><small>اليوم والتاريخ</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(lastInvoice.createdAt))}</b></span>
          <span><small>الوقت</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(lastInvoice.createdAt))}</b></span>
          <span><small>الموظف</small><b>{lastInvoice.cashierName || 'غير محدد'}</b></span>
        </div>
      </div>
      <div className="poultry-invoice-sale-details">
        <span className="poultry-box-kicker">تفاصيل البيع</span>
        <div><span>الصنف</span><b>{lastInvoiceDetails.productName}</b></div>
        <div><span>الوزن</span><b>{fmt(lastInvoiceDetails.quantityKg)} كجم</b></div>
        <div><span>سعر الكيلو</span><b>{fmt(lastInvoiceDetails.unitPrice)} ج.م</b></div>
        <div><span>نافِق</span><b>{fmt(lastInvoiceDetails.deadWeightKg)} كجم · {fmt(lastInvoiceDetails.deadTotal)} ج.م</b></div>
        <div className="sale-total"><span>إجمالي البيع</span><strong>{fmt(lastInvoice.total)} ج.م</strong></div>
      </div>
      <div className="poultry-invoice-totals">
        <div><span>المدفوع</span><b>{fmt(lastInvoice.amountPaid)} ج.م</b></div>
        <div><span>التحصيل من الرصيد السابق</span><b>{fmt(lastInvoice.extraCollection || 0)} ج.م</b></div>
        <div className="total"><span>المتبقي</span><strong>{fmt(lastInvoice.balance)} ج.م</strong></div>
      </div>
      <div className="poultry-invoice-actions">
        <button className="button button-quiet poultry-invoice-exit" onClick={() => setLocation('/poultry-sales')}>خروج</button>
        <button className="button button-primary" onClick={() => setLocation('/poultry-sale/' + encodeURIComponent(customer.id))}><ReceiptText size={16}/> فتح صفحة بيع العميل</button>
        <button className="button button-quiet" onClick={printInvoice}><Printer size={16}/> طباعة</button>
        <button className="button button-quiet" onClick={downloadInvoice}><Download size={16}/> حفظ كصورة</button>
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

  function downloadInvoiceImage(invoice: Awaited<ReturnType<typeof poultryApi.listInvoices>>['invoices'][number]) {
    drawUnifiedInvoiceImage(invoice,{name:invoice.customerName,shopName:invoice.shopName,phone:invoice.phone},invoice.items?.[0],'فاتورة-'+invoice.invoiceNo+'.jpg',session?.invoiceSettings);
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
      <StatCard label="إجمالي المبيعات" value={fmt(data?.summary.sales || 0) + ' ج.م'} detail="قيمة الفواتير" icon={CreditCard} tint="gold"/>
      <StatCard label="إجمالي المدفوع" value={fmt(data?.summary.paid || 0) + ' ج.م'} detail="يشمل التحصيل المرتبط" icon={Wallet}/>
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
              <div className="poultry-invoice-mobile-meta">
                <div className="poultry-invoice-head">
                  <div><span className="poultry-box-kicker">تم الحفظ بنجاح</span><h2>فاتورة {invoice.invoiceNo}</h2></div>
                  <ReceiptText size={25}/>
                </div>
                <div className="poultry-invoice-meta-grid">
                  <span><small>العميل</small><b>{invoice.customerName}</b></span>
                  <span><small>المحل</small><b>{invoice.shopName || 'غير مسجل'}</b></span>
                  <span><small>الهاتف</small><b dir="ltr">{invoice.phone}</b></span>
                  <span><small>اليوم والتاريخ</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(invoice.date))}</b></span>
                  <span><small>الوقت</small><b>{new Intl.DateTimeFormat(APP_EGYPT_DATE_LOCALE,{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'}).format(new Date(invoice.date))}</b></span>
                  <span><small>الموظف</small><b>{invoice.cashierName || 'غير محدد'}</b></span>
                </div>
              </div>
              <div className="poultry-invoice-sale-details">
                <span className="poultry-box-kicker">تفاصيل البيع</span>
                {invoice.items.map((item, index) => <div key={invoice.id+'-'+index}><span>الصنف</span><b>{item.productName || '—'}</b><span>الوزن</span><b>{fmt(Number(item.quantityKg) || 0)} كجم</b><span>سعر الكيلو</span><b>{fmt(Number(item.unitPrice) || 0)} ج.م</b><span>نافِق</span><b>{fmt(Number(item.deadWeightKg) || 0)} كجم · {fmt(Number(item.deadTotal) || 0)} ج.م</b><div className="sale-total"><span>إجمالي البيع</span><strong>{fmt(Number(item.total) || 0)} ج.م</strong></div></div>)}
              </div>
              <div className="poultry-invoice-totals">
                <div><span>المدفوع</span><b>{fmt(invoice.amountPaid)} ج.م</b></div>
                <div><span>التحصيل من الرصيد السابق</span><b>{fmt(invoice.extraCollection || 0)} ج.م</b></div>
                <div className="total"><span>المتبقي</span><strong>{fmt(invoice.balance)} ج.م</strong></div>
              </div>
              <div className="poultry-invoice-actions">
                <button className="button button-quiet poultry-invoice-exit" onClick={() => setExpanded(null)}>خروج</button>
                <button className="button button-primary" onClick={() => setLocation('/poultry-sale/'+encodeURIComponent(invoice.customerId))}><ReceiptText size={16}/> فتح صفحة بيع العميل</button>
                <button className="button button-quiet" onClick={() => printInvoice(invoice)}><Printer size={16}/> طباعة</button>
                <button className="button button-quiet" onClick={() => downloadInvoiceImage(invoice)}><Download size={16}/> حفظ كصورة</button>
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