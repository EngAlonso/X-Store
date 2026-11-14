import { useEffect, useState } from "react";
import { Search, Utensils, CircleAlert } from "lucide-react";
import "./restaurant-menu.css";

type PublicMenu={menu:{title:string;description:string|null};store:{name:string;currency:string};categories:Array<{name:string;items:Array<{id:string;name:string;price:number;ingredients:string|null;description:string|null;imageUrl:string|null;available:boolean}>}>};

export default function PublicRestaurantMenu({params}:{params:{slug:string}}){
  const [data,setData]=useState<PublicMenu|null>(null),[error,setError]=useState(""),[search,setSearch]=useState("");
  useEffect(()=>{fetch("/api/xstore/public/menu/"+encodeURIComponent(params.slug)).then(async r=>{const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(typeof result.error==="string"?result.error:"تعذر تحميل المنيو.");setData(result as PublicMenu);}).catch(e=>setError(e instanceof Error?e.message:"تعذر تحميل المنيو."));},[params.slug]);
  if(error)return <div className="restaurant-public-page"><div className="restaurant-public-error"><CircleAlert size={32}/><h1>المنيو غير متاحة</h1><p>{error}</p></div></div>;
  if(!data)return <div className="restaurant-public-page"><div className="restaurant-menu-loading">جارٍ تحميل المنيو…</div></div>;
  const term=search.trim().toLowerCase();
  const categories=data.categories.map(c=>({...c,items:c.items.filter(i=>!term||(i.name+" "+(i.description||"")+" "+(i.ingredients||"")).toLowerCase().includes(term))})).filter(c=>c.items.length);
  return <div className="restaurant-public-page" dir="rtl"><header className="restaurant-public-header"><span className="restaurant-public-logo"><Utensils size={20}/></span><div><span>{data.store.name}</span><h1>{data.menu.title}</h1>{data.menu.description&&<p>{data.menu.description}</p>}</div></header>
    <label className="restaurant-public-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في المنيو…"/></label>
    <main className="restaurant-public-content">{categories.length?categories.map(category=><section key={category.name} className="restaurant-public-category"><h2>{category.name}</h2><div className="restaurant-public-items">{category.items.map(item=><article key={item.id} className={"restaurant-public-item "+(item.available?"":"unavailable")}>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<div className="restaurant-public-placeholder"><Utensils size={24}/></div>}<div className="restaurant-public-item-body"><h3>{item.name}</h3>{item.description&&<p>{item.description}</p>}{item.ingredients&&<p className="restaurant-public-ingredients"><b>المكونات:</b> {item.ingredients}</p>}<strong>{new Intl.NumberFormat("ar-EG",{maximumFractionDigits:2}).format(item.price)} {data.store.currency}</strong>{!item.available&&<small>غير متاح حالياً</small>}</div></article>)}</div></section>):<div className="restaurant-public-empty">لا توجد أصناف مطابقة للبحث.</div>}</main>
  </div>;
}
