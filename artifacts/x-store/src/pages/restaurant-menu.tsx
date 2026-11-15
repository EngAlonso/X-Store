import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, QrCode, Save, Search, Utensils } from "lucide-react";
import "./restaurant-menu.css";

type MenuProduct = { id:string; name:string; category:string; price:number|null; quantity:number; sku:string; barcode:string|null; selected:boolean; imageUrl:string|null };
function autoProductImageUrl(name:string){
  const normalized=name.trim().toLowerCase();
  const rules=[
    {words:["برجر","burger"],prompt:"a single beef burger"},
    {words:["بيتزا","pizza"],prompt:"a single pizza"},
    {words:["فراخ","دجاج","chicken"],prompt:"chicken meal"},
    {words:["لحمة","لحم","beef"],prompt:"beef dish"},
    {words:["سمك","fish"],prompt:"fish dish"},
    {words:["بطاطس","بطاطا","fries"],prompt:"french fries"},
    {words:["شاورما","shawarma"],prompt:"shawarma sandwich"},
    {words:["كريب","crepe"],prompt:"savory crepe"},
    {words:["باستا","مكرونة","pasta"],prompt:"pasta dish"},
    {words:["رز","أرز","rice"],prompt:"rice dish"},
    {words:["سلطة","salad"],prompt:"fresh salad"},
    {words:["قهوة","coffee"],prompt:"coffee cup"},
    {words:["كابتشينو","cappuccino"],prompt:"cappuccino"},
    {words:["لاتيه","latte"],prompt:"latte coffee"},
    {words:["عصير","juice"],prompt:"fresh fruit juice"},
    {words:["مياه","ماء","water"],prompt:"bottled water"},
    {words:["كيك","cake"],prompt:"cake slice"},
    {words:["دونات","donut"],prompt:"donut"},
    {words:["آيس كريم","ايس كريم","ice cream"],prompt:"ice cream"},
  ];
  const match=rules.find(rule=>rule.words.some(word=>normalized.includes(word)));
  if(!match)return "";
  const seed=Array.from(normalized).reduce((hash,char)=>((hash*31)+char.charCodeAt(0))>>>0,7);
  const prompt=`realistic commercial food photography of ${match.prompt}, matching the product name "${name}", one item only, clean warm neutral background, square composition, no text, no logo`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=600&nologo=true&seed=${seed}`;
}

type MenuResponse = { menu:{id:string;title:string;description:string|null;isPublished:boolean;publicSlug:string}; products:MenuProduct[] };

export default function RestaurantMenuPage() {
  const [data,setData]=useState<MenuResponse|null>(null),[title,setTitle]=useState("منيو المتجر"),[description,setDescription]=useState(""),[published,setPublished]=useState(true),[selected,setSelected]=useState<string[]>([]),[search,setSearch]=useState(""),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");

  async function load(){
    setLoading(true); setError("");
    try{
      const response=await fetch("/api/xstore/menu",{credentials:"include"});
      if(!response.ok) throw new Error("تعذر تحميل إعدادات المنيو.");
      const result=await response.json() as MenuResponse;
      setData(result); setTitle(result.menu.title||"منيو المتجر"); setDescription(result.menu.description||""); setPublished(result.menu.isPublished); setSelected(result.products.filter(p=>p.selected).map(p=>p.id));
    }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل المنيو.");}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  const visibleProducts=useMemo(()=>{const term=search.trim().toLowerCase(); return (data?.products||[]).filter(p=>!term||[p.name,p.category,p.sku,p.barcode||""].join(" ").toLowerCase().includes(term));},[data?.products,search]);
  function toggleProduct(id:string){setSelected(current=>current.includes(id)?current.filter(v=>v!==id):[...current,id]);}
  async function save(){
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/xstore/menu",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,isPublished:published,productIds:selected})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(typeof result.error==="string"?result.error:"تعذر حفظ المنيو.");
      setNotice("تم حفظ المنيو بنجاح."); await load();
    }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ المنيو.");}finally{setSaving(false);}
  }
  const publicUrl=data?window.location.origin+"/menu/"+data.menu.publicSlug:"";
  const qrUrl=publicUrl?"https://api.qrserver.com/v1/create-qr-code/?size=500x500&data="+encodeURIComponent(publicUrl):"";
  function printQr(){
    if(!qrUrl)return; const popup=window.open("","_blank","width=700,height=800"); if(!popup)return;
    popup.document.write('<!doctype html><html dir="rtl"><head><title>QR المنيو</title><style>body{font-family:Arial;text-align:center;padding:30px}img{width:420px;max-width:90vw}</style></head><body><h1>'+title+'</h1><p>امسح الكود لفتح المنيو</p><img src="'+qrUrl+'" onload="window.print()"><p>'+publicUrl+'</p></body></html>'); popup.document.close();
  }
  if(loading)return <div className="restaurant-menu-page"><div className="restaurant-menu-loading">جارٍ تحميل المنيو…</div></div>;
  return <div className="restaurant-menu-page" dir="rtl">
    <div className="restaurant-menu-hero"><div><span className="restaurant-menu-kicker"><Utensils size={16}/> المطاعم والكافيهات</span><h1>إدارة المنيو</h1><p>اختار منتجات المنيو من نفس منتجات المخزون، وتحديث السعر في المخزون ينعكس على المنيو.</p></div><button className="restaurant-menu-save" onClick={()=>void save()} disabled={saving}><Save size={17}/>{saving?"جارٍ الحفظ…":"حفظ المنيو"}</button></div>
    {error&&<div className="restaurant-menu-alert error">{error}</div>}{notice&&<div className="restaurant-menu-alert success">{notice}</div>}
    <div className="restaurant-menu-grid">
      <section className="restaurant-menu-card"><div className="restaurant-menu-card-head"><div><b>بيانات المنيو</b><span>العنوان والوصف وحالة النشر.</span></div></div>
        <label className="restaurant-menu-field"><span>اسم المنيو</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></label>
        <label className="restaurant-menu-field"><span>وصف المنيو</span><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={4}/></label>
        <label className="restaurant-menu-switch"><span><b>{published?"المنيو منشورة":"المنيو مخفية"}</b><small>{published?"العميل يستطيع فتحها من QR.":"الرابط لن يعرض الأصناف."}</small></span><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/></label>
      </section>
      <section className="restaurant-menu-card restaurant-menu-qr-card"><div className="restaurant-menu-card-head"><div><b>QR المنيو</b><span>اطبع الكود وضعه على الترابيزات.</span></div><QrCode size={23}/></div>
        {qrUrl&&<img className="restaurant-menu-qr" src={qrUrl} alt="QR المنيو"/>}<div className="restaurant-menu-url">{publicUrl}</div>
        <div className="restaurant-menu-actions"><button onClick={()=>void navigator.clipboard?.writeText(publicUrl)}><Copy size={15}/> نسخ الرابط</button><button onClick={printQr}><QrCode size={15}/> طباعة QR</button><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> فتح المنيو</a></div>
      </section>
    </div>
    <section className="restaurant-menu-card"><div className="restaurant-menu-card-head"><div><b>منتجات المنيو</b><span>المنتجات المختارة تأتي مباشرة من المخزون.</span></div><strong>{selected.length} منتج مختار</strong></div>
      <label className="restaurant-menu-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث باسم المنتج أو القسم أو SKU…"/></label>
      <div className="restaurant-menu-products">{visibleProducts.length?visibleProducts.map(product=>{
        const checked=selected.includes(product.id);
        return <button type="button" key={product.id} className={"restaurant-menu-product "+(checked?"selected":"")} onClick={()=>toggleProduct(product.id)}>
          <span className="restaurant-menu-product-check">{checked?<Check size={16}/>:null}</span><span className="restaurant-menu-product-image"><img src={product.imageUrl || autoProductImageUrl(product.name)} alt="" onError={event=>{event.currentTarget.style.display="none"}}/></span><span className="restaurant-menu-product-main"><b>{product.name}</b><small>{product.category} · {product.sku}</small></span><span className="restaurant-menu-product-price">{product.price==null?"بدون سعر":product.price}</span><span className={"restaurant-menu-stock "+(product.quantity?"":"empty")}>{product.quantity?"متاح "+product.quantity:"نفد المخزون"}</span>
        </button>;
      }):<div className="restaurant-menu-empty">لا توجد منتجات مطابقة.</div>}</div>
    </section>
    <div className="restaurant-menu-note">العميل يرى المنتجات المختارة فقط، والسعر الحالي من المخزون.</div>
  </div>;
}
