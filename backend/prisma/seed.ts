import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// کاتالوگ اولیه‌ی دارایی‌ها.
//
// از نسخه‌ی قبل تغییر مهم: منبع همه‌ی قیمت‌ها tgju شد. صندوق‌های طلا که قبلاً
// از BrsApi می‌اومدن و اندپوینتش از کار افتاد، حالا از نمادهای ime_fund_* روی
// ajax.json تی‌جی‌یو خونده می‌شن (رایگان، بدون کلید).
//
// sourceRef دقیقاً کلید نماد در https://call3.tgju.org/ajax.json است.
// priceUnit مشخص می‌کنه عدد خام ریالیه (toman → تقسیم بر ۱۰) یا دلاری.
const ASSETS: Array<{
  key: string;
  category: string;
  label: string;
  unit?: string;
  sourceType: string;
  sourceRef?: string;
  priceUnit?: string;
  sortOrder?: number;
}> = [
  // ------------------------------ سکه ------------------------------
  { key: "coin_emami", category: "coin", label: "سکه امامی (تمام)", sourceType: "tgju", sourceRef: "retail_sekee", priceUnit: "toman", sortOrder: 1 },
  { key: "coin_bahar", category: "coin", label: "سکه بهار آزادی", sourceType: "tgju", sourceRef: "retail_sekeb", priceUnit: "toman", sortOrder: 2 },
  { key: "coin_nim", category: "coin", label: "نیم سکه", sourceType: "tgju", sourceRef: "retail_nim", priceUnit: "toman", sortOrder: 3 },
  { key: "coin_robe", category: "coin", label: "ربع سکه", sourceType: "tgju", sourceRef: "retail_rob", priceUnit: "toman", sortOrder: 4 },
  { key: "coin_gerami", category: "coin", label: "سکه گرمی", sourceType: "tgju", sourceRef: "retail_gerami", priceUnit: "toman", sortOrder: 5 },

  // --------------------------- طلا و نقره ---------------------------
  { key: "gold_geram18", category: "gold", label: "طلای ۱۸ عیار (گرم)", unit: "گرم", sourceType: "tgju", sourceRef: "geram18", priceUnit: "toman", sortOrder: 6 },
  { key: "gold_geram24", category: "gold", label: "طلای ۲۴ عیار (گرم)", unit: "گرم", sourceType: "tgju", sourceRef: "geram24", priceUnit: "toman", sortOrder: 7 },
  { key: "gold_mesghal", category: "gold", label: "مثقال طلا", unit: "مثقال", sourceType: "tgju", sourceRef: "mesghal", priceUnit: "toman", sortOrder: 8 },
  { key: "gold_melted", category: "gold", label: "طلای آب‌شده (نقدی)", unit: "مثقال", sourceType: "tgju", sourceRef: "gold_melted_wholesale", priceUnit: "toman", sortOrder: 9 },
  { key: "silver_999_gram", category: "gold", label: "نقره ۹۹۹ (گرم)", unit: "گرم", sourceType: "tgju", sourceRef: "silver_999", priceUnit: "toman", sortOrder: 10 },

  // ---------------------- صندوق‌های طلا و نقره ----------------------
  { key: "fund_kahroba", category: "fund", label: "صندوق طلای کهربا", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_kahroba", priceUnit: "toman", sortOrder: 11 },
  { key: "fund_ayar", category: "fund", label: "صندوق طلای عیار", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_ayar", priceUnit: "toman", sortOrder: 12 },
  { key: "fund_gohar", category: "fund", label: "صندوق طلای گوهر", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_gohar", priceUnit: "toman", sortOrder: 13 },
  { key: "fund_zar", category: "fund", label: "صندوق طلای زر", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_zar", priceUnit: "toman", sortOrder: 14 },
  { key: "fund_mesghal", category: "fund", label: "صندوق طلای مثقال", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_mesghal", priceUnit: "toman", sortOrder: 15 },
  { key: "fund_silver", category: "fund", label: "صندوق نقره سیم", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_silver", priceUnit: "toman", sortOrder: 16 },

  // «گنج» قبلاً دستی بود چون BrsApi نداشتش؛ tgju نماد ime_fund_ganj رو داره.
  // کلید عوض نمی‌شه تا تعداد ثبت‌شده‌ی کاربرها از دست نره.
  { key: "manual_ganj", category: "fund", label: "صندوق طلای گنج", unit: "واحد", sourceType: "tgju", sourceRef: "ime_fund_ganj", priceUnit: "toman", sortOrder: 17 },

  // ------------------------------ ارز ------------------------------
  { key: "currency_usd", category: "currency", label: "دلار آمریکا", unit: "دلار", sourceType: "tgju", sourceRef: "price_dollar_rl", priceUnit: "toman", sortOrder: 20 },
  { key: "currency_eur", category: "currency", label: "یورو", unit: "یورو", sourceType: "tgju", sourceRef: "price_eur", priceUnit: "toman", sortOrder: 21 },
  { key: "currency_tether", category: "currency", label: "تتر (USDT)", unit: "تتر", sourceType: "tgju", sourceRef: "crypto-tether-irr", priceUnit: "toman", sortOrder: 22 },

  // ---------------------------- رمزارز ----------------------------
  // نکته‌ی مهم: نماد ریالی (‎-irr) گرفته می‌شه نه دلاری، تا جمع کل دارایی‌ها
  // که تومانیه درست بمونه. معادل دلاریش رو خود اپ از نرخ دلار حساب می‌کنه.
  { key: "crypto_bitcoin", category: "crypto", label: "بیت‌کوین", unit: "BTC", sourceType: "tgju", sourceRef: "crypto-bitcoin-irr", priceUnit: "toman", sortOrder: 30 },
  { key: "crypto_ethereum", category: "crypto", label: "اتریوم", unit: "ETH", sourceType: "tgju", sourceRef: "crypto-ethereum-irr", priceUnit: "toman", sortOrder: 31 },

  // ------------------------- آیتم‌های دستی -------------------------
  // «فزر» عمداً دستی مونده: مطمئن نیستیم کدوم نماد tgju دقیقاً همینه و
  // نگاشت اشتباه یعنی قیمت غلطِ باورپذیر. ادمین می‌تونه از پنل، نماد درست
  // رو از لیست نمادهای tgju انتخاب کنه.
  { key: "manual_fezar", category: "manual", label: "فزر", sourceType: "manual", sortOrder: 40 },
  { key: "manual_tala_gram", category: "manual", label: "طلای آب‌شده (گرم) — دستی", unit: "گرم", sourceType: "manual", sortOrder: 41 },
];

async function main() {
  for (const a of ASSETS) {
    const data = {
      category: a.category,
      label: a.label,
      unit: a.unit ?? "عدد",
      sourceType: a.sourceType,
      sourceRef: a.sourceRef ?? null,
      priceUnit: a.priceUnit ?? null,
      sortOrder: a.sortOrder ?? 0,
    };
    await prisma.asset.upsert({
      where: { key: a.key },
      update: data,
      create: { key: a.key, ...data },
    });
  }

  // هر دارایی‌ای که هنوز روی BrsApi مونده (مثلاً ادمین دستی ساخته) دیگه
  // قیمت نمی‌گیره. به‌جای اینکه بی‌صدا با قیمت کهنه بمونه، دستی‌اش می‌کنیم
  // تا در پنل ادمین به‌عنوان «بدون قیمت» دیده بشه و تعیین تکلیف بشه.
  const orphaned = await prisma.asset.updateMany({
    where: { sourceType: "brsapi" },
    data: { sourceType: "manual", sourceRef: null },
  });
  if (orphaned.count > 0) {
    console.log(`⚠️  ${orphaned.count} دارایی BrsApi به حالت دستی منتقل شد`);
  }

  console.log(`✅ ${ASSETS.length} دارایی در کاتالوگ seed شد`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
