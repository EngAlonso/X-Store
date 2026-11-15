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
  return <div className="restaurant-public-page" dir="rtl">
    <header className="restaurant-public-header">
      <div className="restaurant-public-brand">
        <span className="restaurant-public-logo"><Utensils size={21}/></span>
        <div>
          <span className="restaurant-public-store">{data.store.name}</span>
          <h1>{data.menu.title}</h1>
          {data.menu.description&&<p>{data.menu.description}</p>}
        </div>
      </div>
      <span className="restaurant-public-badge">المنيو</span>
    </header>
    <div className="restaurant-public-toolbar">
      <label className="restaurant-public-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن صنف أو مكوّن…"/></label>
      {data.categories.length>1&&<nav className="restaurant-public-categories" aria-label="أقسام المنيو">
        {data.categories.map((category,index)=><a key={category.name} href={`#menu-category-${index}`}>{category.name}</a>)}
      </nav>}
    </div>
    <main className="restaurant-public-content">
      {categories.length?categories.map((category,index)=><section id={`menu-category-${data.categories.findIndex(c=>c.name===category.name)}`} key={category.name} className="restaurant-public-category">
        <div className="restaurant-public-category-head"><div><span className="restaurant-public-category-line"/><h2>{category.name}</h2></div><span>{category.items.length} صنف</span></div>
        <div className="restaurant-public-items">
          {category.items.map(item=><article key={item.id} className={`restaurant-public-item ${item.available?"":"unavailable"}`}>
            <div className="restaurant-public-item-media">
              {item.imageUrl?<img src={item.imageUrl} alt=""/>:<div className="restaurant-public-placeholder"><Utensils size={22}/></div>}
              {!item.available&&<span className="restaurant-public-unavailable">غير متاح</span>}
            </div>
            <div className="restaurant-public-item-body">
              <div className="restaurant-public-item-top"><h3>{item.name}</h3><strong>{new Intl.NumberFormat("ar-EG",{maximumFractionDigits:2}).format(item.price)} <small>{data.store.currency}</small></strong></div>
              {item.description&&<p>{item.description}</p>}
              {item.ingredients&&<p className="restaurant-public-ingredients"><b>المكونات</b><span>{item.ingredients}</span></p>}
            </div>
          </article>)}
        </div>
      </section>):<div className="restaurant-public-empty"><span><Search size={22}/></span><h2>مش لاقي الصنف؟</h2><p>جرّب كلمة بحث مختلفة أو امسح البحث.</p>{search&&<button type="button" onClick={()=>setSearch("")}>مسح البحث</button>}</div>}
    </main>
    <footer className="restaurant-public-footer"><span>صُنع بـ <b>♥</b> في مصر</span><small>{data.store.name} · {data.menu.title}</small></footer>
  </div>;
}
