import { getProductIcon as getCurrentProductIcon } from "@/lib/product-icons-current";
import { getProductIcon as getModernProductIcon } from "@/lib/product-icons-modern";

const samples = [
  { name: "قهوة عربية", category: "عام" },
  { name: "موية زمزم", category: "عام" },
  { name: "دشداشة خليجية", category: "عام" },
  { name: "جوال سامسونج", category: "عام" },
  { name: "شوز رياضي", category: "عام" },
  { name: "AirPods Pro", category: "عام" },
  { name: "خبز صامولي", category: "عام" },
  { name: "جنطة جلدية", category: "عام" },
];

export function ProductIconGallery({ modern }: { modern: boolean }) {
  return (
    <main className={`icon-gallery ${modern ? "icon-gallery--modern" : "icon-gallery--current"}`} dir="rtl">
      <header className="icon-gallery-header">
        <span>{modern ? "X-STORE · PRODUCT ART" : "X-STORE · CURRENT ICONS"}</span>
        <h1>{modern ? "أيقونات أوضح، ومنتجات أسهل تمييزًا" : "أيقونات المنتجات الحالية"}</h1>
        <p>
          {modern
            ? "ألوان ناعمة حسب نوع المنتج، مع عمق بسيط يلفت النظر بدون إجهاد العين."
            : "المظهر الحالي للأيقونات على أسماء منتجات متنوعة."}
        </p>
      </header>
      <section className="icon-gallery-grid">
        {samples.map((product) => {
          const { Icon, tone, kind } = (modern ? getModernProductIcon : getCurrentProductIcon)(product);
          return (
            <article className="icon-gallery-card" key={product.name}>
              <span className={`icon-gallery-art art-${tone}`} data-product-icon={kind}>
                <Icon size={23} strokeWidth={1.8} />
              </span>
              <span className="icon-gallery-card-copy">
                <b>{product.name}</b>
                <small>{product.category} · {kind}</small>
              </span>
            </article>
          );
        })}
      </section>
    </main>
  );
}
