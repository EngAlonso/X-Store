import {
  Apple,
  Baby,
  Beef,
  Bike,
  BookOpen,
  Brush,
  Camera,
  Candy,
  Car,
  Cat,
  Coffee,
  CookingPot,
  Cookie,
  Croissant,
  CupSoda,
  Dog,
  Drumstick,
  Dumbbell,
  Fish,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Headphones,
  Laptop,
  Milk,
  NotebookPen,
  Package,
  Pill,
  Plug,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  SprayCan,
  Tv,
  Utensils,
  Watch,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type ProductIconTone = "sage" | "gold" | "mauve" | "blue" | "clay" | "rose";
export type ProductIconKind =
  | "coffee"
  | "drinks"
  | "bakery"
  | "snacks"
  | "produce"
  | "poultry"
  | "seafood"
  | "meat"
  | "dairy"
  | "groceries"
  | "phone"
  | "computer"
  | "audio"
  | "camera"
  | "display"
  | "electronics"
  | "shoes"
  | "clothing"
  | "watch"
  | "books"
  | "stationery"
  | "beauty"
  | "cleaning"
  | "medicine"
  | "bags"
  | "jewelry"
  | "furniture"
  | "cookware"
  | "tableware"
  | "sports"
  | "toys"
  | "baby"
  | "dog"
  | "cat"
  | "automotive"
  | "tools"
  | "bikes"
  | "personal-care"
  | "gifts"
  | "general";

type ProductIconRule = {
  kind: Exclude<ProductIconKind, "general">;
  Icon: LucideIcon;
  tone: ProductIconTone;
  nameTerms: string[];
  categoryTerms: string[];
};

const productIconRules: ProductIconRule[] = [
  {
    kind: "coffee",
    Icon: Coffee,
    tone: "clay",
    nameTerms: [
      "قهوة", "بن", "بن مطحون", "بن محوج", "شاي", "شاي اخضر", "شاي احمر",
      "نسكافيه", "كابتشينو", "قهوة تركي", "قهوة فرنساوي", "اسبرسو", "موكا",
      "coffee", "espresso", "tea", "cappuccino",
    ],
    categoryTerms: ["قهوة", "بن", "شاي", "مشروبات ساخنة", "مشروبات دافئة", "coffee", "tea", "hot drinks"],
  },
  {
    kind: "drinks",
    Icon: CupSoda,
    tone: "blue",
    nameTerms: [
      "مشروب", "عصير", "مية", "ميه", "مايه", "مياه", "ماء", "ازازة مياه",
      "مياه غازية", "مياه معدنية", "بيبسي", "كوكاكولا", "كوكا كولا", "كولا",
      "فانتا", "سفن اب", "سبرايت", "كانز", "شربات", "drink", "juice", "water", "soda", "cola",
    ],
    categoryTerms: ["مشروبات", "مشروب", "عصائر", "مياه", "مشروبات غازية", "beverage", "drinks"],
  },
  {
    kind: "snacks",
    Icon: Cookie,
    tone: "gold",
    nameTerms: [
      "بسكوت", "بسكوتة", "بسكويت", "بسكويته", "شيبسي", "شيبس", "مقرمشات", "سناكس",
      "دوريتوس", "لبان", "بونبون", "بنبون", "مصاصة", "توفي", "شوكولاتة",
      "شيكولاتة", "شيكولاته", "حلويات", "بسبوسة", "كنافة", "قطايف",
      "حلاوة طحينية", "snack", "snacks", "chips", "cookie", "cookies",
    ],
    categoryTerms: ["سناكس", "مقرمشات", "حلويات", "شوكولاتة", "snacks", "candy", "cookies"],
  },
  {
    kind: "bakery",
    Icon: Croissant,
    tone: "gold",
    nameTerms: [
      "عيش", "عيش بلدي", "عيش فينو", "عيش شامي", "عيش سن", "فينو", "رغيف",
      "خبز", "توست", "باتيه", "فطير", "كرواسون", "كروسان", "كيك", "كعك",
      "مخبوزات", "معجنات", "bakery", "bread", "cake", "pastry",
    ],
    categoryTerms: ["مخبوزات", "مخبز", "مخبزات", "معجنات", "bakery", "bread", "pastry"],
  },
  {
    kind: "produce",
    Icon: Apple,
    tone: "sage",
    nameTerms: [
      "فاكهة", "فواكه", "فاكهه", "خضار", "تفاح", "موز", "برتقال", "برتقان",
      "يوسفي", "عنب", "فراولة", "مانجا", "مانجو", "جوافة", "خوخ", "كمثرى",
      "بطيخ", "شمام", "طماطم", "بندورة", "بطاطس", "بطاطا", "بصل", "خيار",
      "فلفل", "كوسة", "جزر", "باذنجان", "ملوخية", "بامية", "ليمون", "ثوم",
      "produce", "fruit", "vegetable", "vegetables",
    ],
    categoryTerms: ["خضار", "خضروات", "فاكهة", "فواكه", "produce", "fruit", "vegetables"],
  },
  {
    kind: "poultry",
    Icon: Drumstick,
    tone: "clay",
    nameTerms: [
      "فراخ", "فراخة", "فرخة", "دجاج", "فراخ بانيه", "بانيه", "وراك فراخ",
      "صدور فراخ", "كتاكيت", "poultry", "chicken",
    ],
    categoryTerms: ["فراخ", "دواجن", "طيور", "poultry", "chicken"],
  },
  {
    kind: "seafood",
    Icon: Fish,
    tone: "blue",
    nameTerms: [
      "سمك", "أسماك", "جمبري", "روبيان", "سردين", "تونة", "فيليه", "بلطي",
      "بوري", "ماكريل", "fish", "seafood", "shrimp", "tuna",
    ],
    categoryTerms: ["أسماك", "سمك", "مأكولات بحرية", "seafood", "fish"],
  },
  {
    kind: "meat",
    Icon: Beef,
    tone: "clay",
    nameTerms: [
      "لحمة", "لحمه", "لحم", "لحوم", "مفروم", "كفتة", "كباب", "سجق",
      "برجر", "بسطرمة", "لانشون", "كبدة", "beef", "meat",
    ],
    categoryTerms: ["لحوم", "لحمة", "لحوم حمراء", "meat", "beef"],
  },
  {
    kind: "dairy",
    Icon: Milk,
    tone: "blue",
    nameTerms: [
      "لبن", "حليب", "جبنة", "جبن", "زبادي", "رايب", "لبن رايب", "قشطة",
      "زبدة", "كريمة طبخ", "كريمة خفق", "لبنة", "ايس كريم", "آيس كريم", "milk", "cheese", "yogurt", "dairy",
    ],
    categoryTerms: ["ألبان", "البان", "منتجات الألبان", "dairy"],
  },
  {
    kind: "phone",
    Icon: Smartphone,
    tone: "blue",
    nameTerms: ["موبايل", "موبيل", "هاتف", "تليفون", "تليفونات", "جوال", "ايفون", "smartphone", "phone", "mobile", "iphone"],
    categoryTerms: ["موبايلات", "هواتف", "تليفونات", "smartphones", "mobile phones", "phones"],
  },
  {
    kind: "computer",
    Icon: Laptop,
    tone: "blue",
    nameTerms: ["لابتوب", "لاب توب", "كمبيوتر", "حاسوب", "pc", "laptop", "computer"],
    categoryTerms: ["كمبيوتر", "حاسب", "لابتوب", "computers", "laptops"],
  },
  {
    kind: "audio",
    Icon: Headphones,
    tone: "mauve",
    nameTerms: ["سماعة", "سماعات", "هيدفون", "ايربودز", "سماعات اذن", "headphone", "earphone", "earbud", "airpods", "audio"],
    categoryTerms: ["سماعات", "صوتيات", "headphones", "audio"],
  },
  {
    kind: "camera",
    Icon: Camera,
    tone: "mauve",
    nameTerms: ["كاميرا", "كاميرات", "camera"],
    categoryTerms: ["كاميرات", "تصوير", "cameras", "photography"],
  },
  {
    kind: "display",
    Icon: Tv,
    tone: "mauve",
    nameTerms: ["تلفزيون", "تليفزيون", "شاشة", "شاشات", "monitor", "television", "tv"],
    categoryTerms: ["شاشات", "تلفزيونات", "tv", "monitors", "displays"],
  },
  {
    kind: "electronics",
    Icon: Plug,
    tone: "blue",
    nameTerms: [
      "شاحن", "كابل", "وصلة", "محول", "فلاشة", "فلاش ميموري", "كيبورد",
      "ماوس", "فارة", "جراب", "كفر", "باور بانك", "charger", "cable", "keyboard",
      "mouse", "electronics",
    ],
    categoryTerms: ["إلكترونيات", "الكترونيات", "إلكتروني", "أجهزة كهربائية", "electronics", "electronic accessories"],
  },
  {
    kind: "shoes",
    Icon: Footprints,
    tone: "clay",
    nameTerms: ["حذاء", "أحذية", "جزمة", "كوتشي", "شبشب", "صندل", "سليبر", "بوط", "shoe", "sneaker", "sandal", "slippers"],
    categoryTerms: ["أحذية", "احذية", "شوز", "shoes", "footwear"],
  },
  {
    kind: "clothing",
    Icon: Shirt,
    tone: "sage",
    nameTerms: [
      "قميص", "تيشيرت", "تيشرت", "تي شيرت", "بلوزة", "بنطلون", "فستان",
      "جاكيت", "جاكت", "عباية", "جلابية", "هدوم", "ملابس", "شراب", "جوارب",
      "shirt", "clothing", "dress", "trousers", "apparel",
    ],
    categoryTerms: ["ملابس", "أزياء", "clothing", "apparel", "fashion"],
  },
  {
    kind: "watch",
    Icon: Watch,
    tone: "gold",
    nameTerms: ["ساعة", "ساعات", "ساعة يد", "watch", "watches"],
    categoryTerms: ["ساعات", "watches"],
  },
  {
    kind: "books",
    Icon: BookOpen,
    tone: "sage",
    nameTerms: ["كتاب", "رواية", "مصحف", "مجلة", "book", "novel", "magazine"],
    categoryTerms: ["كتب", "كتاب", "books", "literature"],
  },
  {
    kind: "stationery",
    Icon: NotebookPen,
    tone: "blue",
    nameTerms: [
      "كراسة", "دفتر", "كشكول", "قلم", "أقلام", "قلم رصاص", "ورق",
      "دوسيه", "استيكة", "براية", "ألوان", "قرطاسية", "notebook", "pen", "stationery",
    ],
    categoryTerms: ["أدوات مكتبية", "ادوات مكتبية", "قرطاسية", "stationery", "office supplies"],
  },
  {
    kind: "personal-care",
    Icon: Brush,
    tone: "clay",
    nameTerms: ["فرشاة", "مشط", "فرشة شعر", "brush", "comb", "hairbrush"],
    categoryTerms: ["عناية شخصية", "personal care"],
  },
  {
    kind: "beauty",
    Icon: Sparkles,
    tone: "mauve",
    nameTerms: [
      "مكياج", "ميكاب", "عطر", "برفان", "كولونيا", "كريم", "شامبو", "بلسم",
      "غسول", "سيروم", "مزيل عرق", "كحل", "روج", "بودرة", "makeup", "cosmetic",
      "perfume", "skincare", "beauty",
    ],
    categoryTerms: ["تجميل", "عطور", "مستحضرات تجميل", "مستحضرات عناية", "beauty", "cosmetics", "perfume"],
  },
  {
    kind: "cleaning",
    Icon: SprayCan,
    tone: "sage",
    nameTerms: [
      "منظف", "مطهر", "صابون", "مسحوق غسيل", "كلور", "ديتول", "سائل مواعين",
      "سائل تنظيف", "فيري", "cleaner", "detergent", "soap", "cleaning",
    ],
    categoryTerms: ["منظفات", "تنظيف", "مستلزمات نظافة", "cleaning", "detergents"],
  },
  {
    kind: "medicine",
    Icon: Pill,
    tone: "rose",
    nameTerms: ["دواء", "علاج", "فيتامين", "حبوب", "مسكن", "بانادول", "مضاد حيوي", "medicine", "vitamin", "pharmacy"],
    categoryTerms: ["أدوية", "ادوية", "صيدلية", "pharmacy", "medicine"],
  },
  {
    kind: "bags",
    Icon: ShoppingBag,
    tone: "gold",
    nameTerms: ["شنطة", "شنط", "حقيبة", "محفظة", "bag", "purse", "wallet"],
    categoryTerms: ["حقائب", "شنط", "bags", "luggage"],
  },
  {
    kind: "jewelry",
    Icon: Gem,
    tone: "mauve",
    nameTerms: ["ذهب", "فضة", "خاتم", "سلسلة", "مجوهرات", "jewelry", "ring", "necklace"],
    categoryTerms: ["مجوهرات", "ذهب", "jewelry"],
  },
  {
    kind: "furniture",
    Icon: Sofa,
    tone: "clay",
    nameTerms: ["كنبة", "كرسي", "أثاث", "دولاب", "ترابيزة", "مكتب", "سرير", "مرتبة", "انتريه", "sofa", "furniture", "chair"],
    categoryTerms: ["أثاث", "اثاث", "أثاث منزلي", "furniture", "home decor"],
  },
  {
    kind: "cookware",
    Icon: CookingPot,
    tone: "gold",
    nameTerms: ["حلة", "طاسة", "مقلاة", "طنجرة", "طقم حلل", "pot", "pan", "cookware"],
    categoryTerms: ["أواني طهي", "أواني الطبخ", "حلل", "cookware"],
  },
  {
    kind: "tableware",
    Icon: Utensils,
    tone: "gold",
    nameTerms: ["معلقة", "ملعقة", "شوكة", "سكينة", "طبق", "كوب", "كوباية", "كاس", "مواعين", "utensil", "cutlery"],
    categoryTerms: ["أدوات منزلية", "ادوات منزلية", "أدوات مطبخ", "أدوات المطبخ", "مطبخ", "housewares", "kitchenware"],
  },
  {
    kind: "sports",
    Icon: Dumbbell,
    tone: "sage",
    nameTerms: ["رياضة", "كرة", "كورة", "دمبل", "تمرين", "حبل نط", "مضرب", "sport", "fitness", "dumbbell"],
    categoryTerms: ["رياضة", "معدات رياضية", "sports", "fitness"],
  },
  {
    kind: "toys",
    Icon: Gamepad2,
    tone: "mauve",
    nameTerms: ["لعبة", "ألعاب", "العاب", "مكعبات", "عروسة", "دمية", "بازل", "بلايستيشن", "اكس بوكس", "عربية لعبة", "game", "gaming", "console", "toy"],
    categoryTerms: ["ألعاب", "العاب", "ألعاب أطفال", "العاب اطفال", "toys", "games", "gaming"],
  },
  {
    kind: "baby",
    Icon: Baby,
    tone: "rose",
    nameTerms: ["حفاض", "حفاضة", "بامبرز", "رضاعة", "ببرونة", "لهاية", "لبن أطفال", "عربة أطفال", "baby", "diaper"],
    categoryTerms: ["أطفال", "اطفال", "رضع", "مستلزمات أطفال", "baby", "kids"],
  },
  {
    kind: "dog",
    Icon: Dog,
    tone: "gold",
    nameTerms: ["كلب", "كلاب", "أكل كلاب", "dog"],
    categoryTerms: ["كلاب", "حيوانات أليفة", "dogs", "dog supplies", "pet supplies"],
  },
  {
    kind: "cat",
    Icon: Cat,
    tone: "mauve",
    nameTerms: ["قط", "قطة", "قطط", "أكل قطط", "cat"],
    categoryTerms: ["قطط", "cats", "cat supplies"],
  },
  {
    kind: "automotive",
    Icon: Car,
    tone: "blue",
    nameTerms: ["سيارة", "سيارات", "عربية", "عربيات", "عربية ملاكي", "قطع غيار", "car", "automotive", "auto parts"],
    categoryTerms: ["سيارات", "عربيات", "قطع غيار", "automotive", "auto parts"],
  },
  {
    kind: "tools",
    Icon: Wrench,
    tone: "clay",
    nameTerms: ["عدة", "مفك", "شاكوش", "مطرقة", "مفتاح ربط", "كماشة", "دريل", "مسمار", "tool", "wrench", "hammer"],
    categoryTerms: ["عدد", "أدوات", "ادوات", "هاردوير", "tools", "hardware"],
  },
  {
    kind: "bikes",
    Icon: Bike,
    tone: "sage",
    nameTerms: ["عجلة", "دراجة", "دراجة هوائية", "bicycle", "bike"],
    categoryTerms: ["دراجات", "عجل", "bicycles", "bikes"],
  },
  {
    kind: "gifts",
    Icon: Gift,
    tone: "gold",
    nameTerms: ["هدية", "هدايا", "gift"],
    categoryTerms: ["هدايا", "gifts"],
  },
  {
    kind: "groceries",
    Icon: ShoppingBasket,
    tone: "sage",
    nameTerms: [],
    categoryTerms: ["بقالة", "مواد غذائية", "سوبر ماركت", "grocery", "groceries"],
  },
];

function normalizeProductText(value: string): string {
  return value
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const articlePrefixes = ["وال", "بال", "كال", "فال", "ال"];

function tokenVariants(token: string): Set<string> {
  const variants = new Set([token]);
  for (const prefix of articlePrefixes) {
    if (token.startsWith(prefix) && token.length - prefix.length >= 2) {
      variants.add(token.slice(prefix.length));
    }
  }
  return variants;
}

function tokenizeProductText(value: string): Set<string>[] {
  return normalizeProductText(value)
    .split(" ")
    .filter(Boolean)
    .map(tokenVariants);
}

function containsPhrase(tokens: Set<string>[], phrase: string[]): boolean {
  if (!phrase.length || phrase.length > tokens.length) return false;
  for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
    if (phrase.every((word, offset) => tokens[start + offset].has(word))) return true;
  }
  return false;
}

const normalizedProductIconRules = productIconRules.map(rule => ({
  ...rule,
  nameTerms: rule.nameTerms.map(term => normalizeProductText(term).split(" ")),
  categoryTerms: rule.categoryTerms.map(term => normalizeProductText(term).split(" ")),
}));

const genericIcon = { kind: "general", Icon: Package, tone: "sage" } as const;

function firstPhrasePosition(tokens: Set<string>[], phrase: string[]): number | null {
  if (!phrase.length || phrase.length > tokens.length) return null;
  for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
    if (phrase.every((word, offset) => tokens[start + offset].has(word))) return start;
  }
  return null;
}

function bestRuleFor(tokens: Set<string>[], field: "nameTerms" | "categoryTerms") {
  let bestRule: (typeof normalizedProductIconRules)[number] | undefined;
  let bestPosition = Number.POSITIVE_INFINITY;
  for (const rule of normalizedProductIconRules) {
    for (const term of rule[field]) {
      const position = firstPhrasePosition(tokens, term);
      if (position !== null && position < bestPosition) {
        bestRule = rule;
        bestPosition = position;
      }
    }
  }
  return bestRule;
}

export function getProductIcon(product: { name?: string | null; category?: string | null }) {
  const nameTokens = tokenizeProductText(product.name ?? "");
  const categoryTokens = tokenizeProductText(product.category ?? "");
  const byName = bestRuleFor(nameTokens, "nameTerms");
  const byCategory = bestRuleFor(categoryTokens, "categoryTerms");
  const match = byName ?? byCategory;
  return match
    ? { kind: match.kind, Icon: match.Icon, tone: match.tone }
    : genericIcon;
}
