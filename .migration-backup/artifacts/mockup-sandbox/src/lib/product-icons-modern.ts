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
  createLucideIcon,
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
  Pizza,
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
  | "pizza"
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
  | "sneakers"
  | "pants"
  | "jacket"
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
      "قهوة", "قهوه", "بن", "بن مطحون", "بن محوج", "شاي", "شاهي", "شاي اخضر", "شاي احمر",
      "نسكافيه", "كابتشينو", "قهوة عربي", "قهوة عربية", "قهوة تركي", "قهوة فرنساوي", "اسبرسو", "موكا",
      "coffee", "espresso", "tea", "cappuccino", "americano", "latte", "matcha",
    ],
    categoryTerms: ["قهوة", "بن", "شاي", "شاهي", "مشروبات ساخنة", "مشروبات دافئة", "coffee", "tea", "hot drinks"],
  },
  {
    kind: "drinks",
    Icon: CupSoda,
    tone: "blue",
    nameTerms: [
      "مشروب", "عصير", "عصاير", "مية", "ميه", "مايه", "مياه", "ماء", "موية", "مويه", "ماي", "ازازة مياه",
      "مياه غازية", "مياه معدنية", "بيبسي", "كوكاكولا", "كوكا كولا", "كولا",
      "فانتا", "سفن اب", "سبن اب", "سبرايت", "كانز", "شربات", "مشروب طاقة", "drink", "beverage",
      "juice", "water", "soda", "cola", "soft drink", "sparkling water", "energy drink", "bottled water",
    ],
    categoryTerms: ["مشروبات", "مشروب", "عصائر", "عصاير", "مياه", "موية", "مويه", "مشروبات غازية", "beverage", "drinks", "soft drinks"],
  },
  {
    kind: "pizza",
    Icon: Pizza,
    tone: "gold",
    nameTerms: [
      "بيتزا", "بيتسا", "بيتزا مارجريتا", "بيتزا مارغريتا", "بيتزا سجق", "بيتزا فراخ",
      "بيتزا خضار", "بيتزا جبنة", "pizza", "pizzas", "pepperoni pizza", "margherita pizza",
      "frozen pizza",
    ],
    categoryTerms: ["بيتزا", "بيتسا", "pizzeria", "pizza", "pizzas"],
  },
  {
    kind: "snacks",
    Icon: Cookie,
    tone: "gold",
    nameTerms: [
      "بسكوت", "بسكوتة", "بسكويت", "بسكويته", "شيبسي", "شيبس", "مقرمشات", "سناكس",
      "دوريتوس", "لبان", "بونبون", "بنبون", "مصاصة", "توفي", "شوكولاتة",
      "شيكولاتة", "شيكولاته", "حلويات", "حلا", "حلوى", "بسبوسة", "كنافة", "قطايف",
      "حلاوة طحينية", "فشار", "بوب كورن", "popcorn", "snack", "snacks", "chips", "crisps",
      "cookie", "cookies", "biscuit", "biscuits", "candy", "chocolate", "sweets",
    ],
    categoryTerms: ["سناكس", "مقرمشات", "حلويات", "شوكولاتة", "snacks", "candy", "cookies"],
  },
  {
    kind: "bakery",
    Icon: Croissant,
    tone: "gold",
    nameTerms: [
      "عيش", "عيش بلدي", "عيش فينو", "عيش شامي", "عيش سن", "فينو", "رغيف",
      "خبز", "خبز عربي", "صامولي", "تميس", "توست", "باتيه", "فطير", "كرواسون", "كروسان", "كيك", "كعك",
      "مخبوزات", "معجنات", "bakery", "bread", "bun", "bagel", "cake", "pastry", "croissant", "brioche",
    ],
    categoryTerms: ["مخبوزات", "مخبز", "مخبزات", "معجنات", "bakery", "bread", "pastry", "baked goods"],
  },
  {
    kind: "produce",
    Icon: Apple,
    tone: "sage",
    nameTerms: [
      "فاكهة", "فواكه", "فاكهه", "خضار", "تفاح", "موز", "برتقال", "برتقان",
      "يوسفي", "عنب", "فراولة", "مانجا", "مانجو", "جوافة", "خوخ", "كمثرى",
      "بطيخ", "شمام", "طماطم", "بندورة", "بطاطس", "بطاطا", "بصل", "خيار",
      "فلفل", "كوسة", "جزر", "باذنجان", "ملوخية", "بامية", "ليمون", "ثوم", "خضرة",
      "produce", "fruit", "fruits", "vegetable", "vegetables", "tomato", "potato", "onion",
    ],
    categoryTerms: ["خضار", "خضروات", "فاكهة", "فواكه", "produce", "fruit", "vegetables"],
  },
  {
    kind: "poultry",
    Icon: Drumstick,
    tone: "clay",
    nameTerms: [
      "فراخ", "فراخة", "فرخة", "دجاج", "دياي", "دجاجة", "فراخ بانيه", "بانيه", "وراك فراخ",
      "صدور فراخ", "كتاكيت", "poultry", "chicken", "chicken breast", "wings",
    ],
    categoryTerms: ["فراخ", "دواجن", "طيور", "poultry", "chicken"],
  },
  {
    kind: "seafood",
    Icon: Fish,
    tone: "blue",
    nameTerms: [
      "سمك", "أسماك", "جمبري", "روبيان", "سردين", "تونة", "فيليه", "بلطي",
      "بوري", "ماكريل", "fish", "seafood", "shrimp", "prawn", "tuna", "salmon",
    ],
    categoryTerms: ["أسماك", "سمك", "مأكولات بحرية", "seafood", "fish"],
  },
  {
    kind: "meat",
    Icon: Beef,
    tone: "clay",
    nameTerms: [
      "لحمة", "لحمه", "لحم", "لحوم", "لحم غنم", "لحم بقر", "لحم حاشي", "حاشي", "غنم", "خروف",
      "مفروم", "لحمة مفرومة", "لحم مفروم", "كفتة", "كباب", "سجق", "برجر", "بسطرمة", "لانشون", "كبدة",
      "beef", "meat", "lamb", "mutton", "minced meat", "sausage",
    ],
    categoryTerms: ["لحوم", "لحمة", "لحوم حمراء", "meat", "beef"],
  },
  {
    kind: "dairy",
    Icon: Milk,
    tone: "blue",
    nameTerms: [
      "لبن", "حليب", "جبنة", "جبن", "زبادي", "روب", "رايب", "لبن رايب", "لبن خاثر", "قشطة",
      "زبدة", "كريمة طبخ", "كريمة خفق", "لبنة", "ايس كريم", "آيس كريم",
      "milk", "cheese", "yogurt", "yoghurt", "dairy", "butter", "cream", "ice cream",
    ],
    categoryTerms: ["ألبان", "البان", "منتجات الألبان", "dairy"],
  },
  {
    kind: "phone",
    Icon: Smartphone,
    tone: "blue",
    nameTerms: [
      "موبايل", "موبيل", "هاتف", "تليفون", "تليفونات", "جوال", "جهاز جوال", "ايفون", "آيفون",
      "smartphone", "phone", "mobile", "cell phone", "cellphone", "iphone", "samsung galaxy",
    ],
    categoryTerms: ["موبايلات", "هواتف", "تليفونات", "جوالات", "smartphones", "mobile phones", "phones"],
  },
  {
    kind: "computer",
    Icon: Laptop,
    tone: "blue",
    nameTerms: ["لابتوب", "لاب توب", "كمبيوتر", "حاسوب", "حاسب آلي", "pc", "laptop", "computer", "desktop", "notebook computer"],
    categoryTerms: ["كمبيوتر", "حاسب", "حاسوب", "لابتوب", "computers", "laptops", "desktops"],
  },
  {
    kind: "audio",
    Icon: Headphones,
    tone: "mauve",
    nameTerms: [
      "سماعة", "سماعات", "هيدفون", "ايربودز", "سماعات اذن", "سماعة بلوتوث",
      "headphone", "headphones", "earphone", "earphones", "earbud", "earbuds", "airpods", "audio", "speaker",
    ],
    categoryTerms: ["سماعات", "صوتيات", "سماعات أذن", "headphones", "audio", "speakers"],
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
    nameTerms: ["تلفزيون", "تليفزيون", "شاشة", "شاشات", "monitor", "television", "tv", "display"],
    categoryTerms: ["شاشات", "تلفزيونات", "tv", "monitors", "displays", "screens"],
  },
  {
    kind: "electronics",
    Icon: Plug,
    tone: "blue",
    nameTerms: [
      "شاحن", "كابل", "وصلة", "محول", "فلاشة", "فلاش ميموري", "كيبورد",
      "ماوس", "فارة", "جراب", "كفر", "باور بانك", "اكسسوارات جوال", "شاحن متنقل",
      "charger", "cable", "keyboard", "mouse", "power bank", "phone case", "electronics",
    ],
    categoryTerms: ["إلكترونيات", "الكترونيات", "إلكتروني", "أجهزة كهربائية", "اكسسوارات", "electronics", "electronic accessories"],
  },
  {
    kind: "sneakers",
    Icon: createLucideIcon("Sneakers", [
      ["path", { d: "M3 15.5c2.7 0 4.5-1.1 5.6-4 .3-.8 1.3-1 1.9-.4l2.5 2.4c1.1 1 2.5 1.5 4 1.5H18a3 3 0 0 1 3 3v3H3v-5.5Z", key: "sneaker-outline" }],
      ["path", { d: "M3 18h18M8.5 13l1.5 1M10.5 12l1.5 1", key: "sneaker-sole-and-laces" }],
    ]),
    tone: "clay",
    nameTerms: [
      "كوتشي", "كوتشيات", "كوتشي رياضي", "كوتشي جري", "سنيكر", "سنيكرز",
      "جزمة رياضية", "حذاء رياضي", "حذاء جري", "حذاء للجري", "شوز رياضي",
      "sneaker", "sneakers", "trainer", "trainers", "running shoes", "athletic shoes", "sports shoes",
    ],
    categoryTerms: ["أحذية رياضية", "أحذية جري", "سنيكرز", "كوتشي", "sneakers", "trainers", "athletic shoes"],
  },
  {
    kind: "shoes",
    Icon: Footprints,
    tone: "clay",
    nameTerms: [
      "حذاء", "أحذية", "جزمة", "شوز", "شبشب", "نعال", "شحاطة", "صندل", "سليبر", "بوط", "كروكس",
      "shoe", "sandal", "slippers", "footwear", "boots", "crocs",
    ],
    categoryTerms: ["أحذية", "احذية", "شوز", "نعال", "shoes", "footwear"],
  },
  {
    kind: "pants",
    Icon: createLucideIcon("Pants", [
      ["path", { d: "M7 3h10l1.5 18h-5l-1.5-7-1.5 7h-5L7 3Z", key: "pants-outline" }],
      ["path", { d: "M7.5 7h9M12 3v11", key: "pants-seams" }],
    ]),
    tone: "blue",
    nameTerms: [
      "بنطلون", "بنطلونات", "بنطال", "بناطيل", "سروال", "سراويل", "جينز", "بنطلون جينز",
      "بنطلون قماش", "بنطلون رياضي", "بنطلون رجالي", "بنطلون نسائي", "ليجنز", "ليقنز",
      "pants", "trouser", "trousers", "jeans", "leggings", "slacks",
    ],
    categoryTerms: ["بناطيل", "بنطلونات", "سراويل", "pants", "trousers", "jeans", "bottoms"],
  },
  {
    kind: "jacket",
    Icon: createLucideIcon("Jacket", [
      ["path", { d: "m8 3 4 3 4-3 3 2 2 8-4 1-1-3v10H8V11l-1 3-4-1 2-8 3-2Z", key: "jacket-outline" }],
      ["path", { d: "M12 6v15M9 5.5l3 3 3-3M7 12l1-1M17 11l1 1", key: "jacket-zipper-and-collar" }],
    ]),
    tone: "sage",
    nameTerms: [
      "جاكيت", "جاكت", "جاكيتات", "جاكتات", "جكيت", "معطف",
      "jacket", "jackets", "coat", "coats", "windbreaker", "parka", "outerwear", "blazer",
    ],
    categoryTerms: ["جاكيتات", "معاطف", "ملابس خارجية", "outerwear", "jackets", "coats"],
  },
  {
    kind: "clothing",
    Icon: Shirt,
    tone: "sage",
    nameTerms: [
      "قميص", "تيشيرت", "تيشرت", "تي شيرت", "بلوزة", "فستان",
      "عباية", "عبايه", "عباءة", "جلابية", "دشداشة", "ثوب", "هدوم", "ملابس", "شراب", "جوارب",
      "شورت", "shirt", "t shirt", "tee", "hoodie", "clothing", "dress", "apparel",
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
      "كراسة", "دفتر", "كشكول", "قلم", "أقلام", "قلم حبر", "قلم رصاص", "ورق",
      "دوسيه", "استيكة", "براية", "ألوان", "قرطاسية", "notebook", "pen", "pencil", "stationery",
    ],
    categoryTerms: ["أدوات مكتبية", "ادوات مكتبية", "قرطاسية", "stationery", "office supplies"],
  },
  {
    kind: "personal-care",
    Icon: Brush,
    tone: "clay",
    nameTerms: ["فرشاة", "مشط", "فرشة شعر", "مشط شعر", "brush", "comb", "hairbrush", "nail clipper"],
    categoryTerms: ["عناية شخصية", "personal care"],
  },
  {
    kind: "beauty",
    Icon: Sparkles,
    tone: "mauve",
    nameTerms: [
      "مكياج", "ميكاب", "ميكب", "عطر", "عطور", "برفان", "كولونيا", "كريم", "شامبو", "بلسم",
      "غسول", "سيروم", "مزيل عرق", "مزيل العرق", "كحل", "روج", "بودرة", "makeup", "cosmetic",
      "perfume", "fragrance", "skincare", "beauty", "sunscreen", "deodorant", "shampoo",
    ],
    categoryTerms: ["تجميل", "عطور", "مستحضرات تجميل", "مستحضرات عناية", "beauty", "cosmetics", "perfume"],
  },
  {
    kind: "cleaning",
    Icon: SprayCan,
    tone: "sage",
    nameTerms: [
      "منظف", "مطهر", "صابون", "مسحوق غسيل", "كلور", "ديتول", "سائل مواعين", "سائل جلي",
      "سائل تنظيف", "فيري", "منظفات", "cleaner", "detergent", "soap", "cleaning", "laundry", "dish soap",
    ],
    categoryTerms: ["منظفات", "تنظيف", "مستلزمات نظافة", "cleaning", "detergents"],
  },
  {
    kind: "medicine",
    Icon: Pill,
    tone: "rose",
    nameTerms: ["دواء", "علاج", "فيتامين", "حبوب", "مسكن", "بانادول", "مضاد حيوي", "دواء صيدلية", "medicine", "vitamin", "pharmacy", "medicine", "drug", "supplement"],
    categoryTerms: ["أدوية", "ادوية", "صيدلية", "pharmacy", "medicine"],
  },
  {
    kind: "bags",
    Icon: ShoppingBag,
    tone: "gold",
    nameTerms: ["شنطة", "شنط", "جنطة", "حقيبة", "حقيبة ظهر", "محفظة", "شنطة ظهر", "bag", "purse", "wallet", "backpack", "luggage"],
    categoryTerms: ["حقائب", "شنط", "جنط", "bags", "luggage", "backpacks"],
  },
  {
    kind: "jewelry",
    Icon: Gem,
    tone: "mauve",
    nameTerms: ["ذهب", "فضة", "خاتم", "سلسلة", "مجوهرات", "حلي", "اسورة", "سوار", "jewelry", "ring", "necklace", "bracelet"],
    categoryTerms: ["مجوهرات", "ذهب", "حلي", "jewelry", "accessories"],
  },
  {
    kind: "furniture",
    Icon: Sofa,
    tone: "clay",
    nameTerms: ["كنبة", "كنب", "كرسي", "أثاث", "دولاب", "ترابيزة", "طاولة", "مكتب", "سرير", "مرتبة", "انتريه", "أريكة", "صوفا", "sofa", "couch", "furniture", "chair", "table", "desk", "bed"],
    categoryTerms: ["أثاث", "اثاث", "أثاث منزلي", "furniture", "home decor"],
  },
  {
    kind: "cookware",
    Icon: CookingPot,
    tone: "gold",
    nameTerms: ["حلة", "حله", "طاسة", "مقلاة", "طنجرة", "قدر", "قدر ضغط", "طقم حلل", "pot", "pan", "cookware", "pressure cooker"],
    categoryTerms: ["أواني طهي", "أواني الطبخ", "حلل", "cookware"],
  },
  {
    kind: "tableware",
    Icon: Utensils,
    tone: "gold",
    nameTerms: ["معلقة", "ملعقة", "ملاعق", "شوكة", "سكينة", "طبق", "كوب", "كوباية", "كاسة", "كاس", "مواعين", "utensil", "cutlery", "plate", "cup", "glass", "fork", "spoon"],
    categoryTerms: ["أدوات منزلية", "ادوات منزلية", "أدوات مطبخ", "أدوات المطبخ", "مطبخ", "housewares", "kitchenware"],
  },
  {
    kind: "sports",
    Icon: Dumbbell,
    tone: "sage",
    nameTerms: ["رياضة", "كرة", "كورة", "كرة قدم", "دمبل", "تمرين", "حبل نط", "مضرب", "أدوات رياضية", "sport", "sports", "fitness", "dumbbell", "exercise"],
    categoryTerms: ["رياضة", "معدات رياضية", "sports", "fitness"],
  },
  {
    kind: "toys",
    Icon: Gamepad2,
    tone: "mauve",
    nameTerms: ["لعبة", "ألعاب", "العاب", "مكعبات", "عروسة", "دمية", "بازل", "بلايستيشن", "اكس بوكس", "عربية لعبة", "ألعاب أطفال", "لعبة أطفال", "game", "gaming", "console", "toy", "toys", "puzzle", "playstation", "xbox"],
    categoryTerms: ["ألعاب", "العاب", "ألعاب أطفال", "العاب اطفال", "toys", "games", "gaming"],
  },
  {
    kind: "baby",
    Icon: Baby,
    tone: "rose",
    nameTerms: ["حفاض", "حفاضة", "حفاضات", "بامبرز", "رضاعة", "ببرونة", "لهاية", "لبن أطفال", "عربة أطفال", "بيبي", "baby", "diaper", "diapers", "baby formula"],
    categoryTerms: ["أطفال", "اطفال", "رضع", "مستلزمات أطفال", "baby", "kids"],
  },
  {
    kind: "dog",
    Icon: Dog,
    tone: "gold",
    nameTerms: ["كلب", "كلاب", "أكل كلاب", "dog", "dogs", "puppy", "dog food"],
    categoryTerms: ["كلاب", "حيوانات أليفة", "dogs", "dog supplies", "pet supplies"],
  },
  {
    kind: "cat",
    Icon: Cat,
    tone: "mauve",
    nameTerms: ["قط", "قطة", "قطط", "بسة", "بسس", "أكل قطط", "cat", "cats", "kitten", "cat food"],
    categoryTerms: ["قطط", "بساس", "cats", "cat supplies"],
  },
  {
    kind: "automotive",
    Icon: Car,
    tone: "blue",
    nameTerms: ["سيارة", "سيارات", "عربية", "عربيات", "موتر", "مركبة", "عربية ملاكي", "قطع غيار", "car", "automotive", "auto parts", "vehicle", "spare parts"],
    categoryTerms: ["سيارات", "عربيات", "مواتر", "قطع غيار", "automotive", "auto parts", "vehicles"],
  },
  {
    kind: "tools",
    Icon: Wrench,
    tone: "clay",
    nameTerms: ["عدة", "مفك", "شاكوش", "مطرقة", "مفتاح ربط", "كماشة", "زرادية", "دريل", "مسمار", "tool", "tools", "wrench", "hammer", "drill", "screwdriver"],
    categoryTerms: ["عدد", "أدوات", "ادوات", "هاردوير", "tools", "hardware"],
  },
  {
    kind: "bikes",
    Icon: Bike,
    tone: "sage",
    nameTerms: ["عجلة", "دراجة", "دراجة هوائية", "سيكل", "بايسكل", "bicycle", "bike", "bikes", "cycle"],
    categoryTerms: ["دراجات", "عجل", "سيكل", "bicycles", "bikes", "cycles"],
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
    .replace(/\p{M}/gu, "")
    .replace(/[\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/[ک]/g, "ك")
    .replace(/[ی]/g, "ي")
    .replace(/[پ]/g, "ب")
    .replace(/[چ]/g, "ج")
    .replace(/[ڤ]/g, "ف")
    .replace(/[گ]/g, "ك")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const articlePrefixes = ["وال", "بال", "كال", "فال", "لل", "ال", "و", "ب", "ف", "ل"];

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

const relatedProductIconKinds: Partial<Record<ProductIconKind, ProductIconKind[]>> = {
  clothing: ["pants", "jacket"],
  shoes: ["sneakers"],
  bakery: ["pizza"],
};

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
  let bestTermLength = 0;
  for (const rule of normalizedProductIconRules) {
    for (const term of rule[field]) {
      const position = firstPhrasePosition(tokens, term);
      if (
        position !== null &&
        (position < bestPosition || (position === bestPosition && term.length > bestTermLength))
      ) {
        bestRule = rule;
        bestPosition = position;
        bestTermLength = term.length;
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

type ProductSearchTarget = {
  name?: string | null;
  category?: string | null;
  sku?: string | null;
  barcode?: string | null;
  partNumber?: string | null;
};

export function matchesProductSearch(product: ProductSearchTarget, query: string): boolean {
  const normalizedQuery = normalizeProductText(query);
  if (!normalizedQuery) return true;

  const searchable = normalizeProductText(
    [
      product.name,
      product.category,
      product.sku,
      product.barcode,
      product.partNumber,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (searchable.includes(normalizedQuery)) return true;

  const queryTokens = tokenizeProductText(query);
  const queryRule =
    bestRuleFor(queryTokens, "nameTerms") ??
    bestRuleFor(queryTokens, "categoryTerms");
  if (!queryRule) return false;

  // Only use cross-language matching for a category-only query, not extra
  // descriptive words such as a color or model number.
  const ruleVocabulary = [
    ...queryRule.nameTerms.flat(),
    ...queryRule.categoryTerms.flat(),
  ];
  const isCategoryOnlyQuery = queryTokens.every((token) =>
    [...token].some((variant) => ruleVocabulary.includes(variant)),
  );
  const productKind = getProductIcon(product).kind;
  const matchingKinds = [queryRule.kind, ...(relatedProductIconKinds[queryRule.kind] ?? [])];
  return isCategoryOnlyQuery && matchingKinds.includes(productKind);
}
