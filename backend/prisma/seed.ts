import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// کاتالوگ اولیه‌ی دارایی‌ها — همون آیتم‌هایی که در نسخه‌ی وب قبلی بودن،
// به‌علاوه‌ی جای خالی برای نقره که بعداً اضافه می‌شه.
const ASSETS: Array<{
  key: string;
  category: string;
  label: string;
  unit?: string;
  sourceType: string;
  sourceRef?: string;
  sortOrder?: number;
}> = [
  // سکه‌ها (منبع: tgju.org)
  { key: "coin_emami", category: "coin", label: "سکه امامی (تمام)", sourceType: "tgju", sourceRef: "retail_sekee", sortOrder: 1 },
  { key: "coin_nim", category: "coin", label: "نیم سکه", sourceType: "tgju", sourceRef: "retail_nim", sortOrder: 2 },
  { key: "coin_robe", category: "coin", label: "ربع سکه", sourceType: "tgju", sourceRef: "retail_rob", sortOrder: 3 },

  // صندوق‌های طلا (منبع: BrsApi) - sourceRef بخشی از نام فارسی نماد برای تطبیقه
  { key: "fund_kahroba", category: "fund", label: "صندوق طلای کهربا", unit: "واحد", sourceType: "brsapi", sourceRef: "کهربا", sortOrder: 10 },
  { key: "fund_ayar", category: "fund", label: "صندوق طلای عیار", unit: "واحد", sourceType: "brsapi", sourceRef: "عیار", sortOrder: 11 },
  { key: "fund_gohar", category: "fund", label: "صندوق طلای گوهر", unit: "واحد", sourceType: "brsapi", sourceRef: "گوهر", sortOrder: 12 },
  { key: "fund_zar", category: "fund", label: "صندوق طلای زر", unit: "واحد", sourceType: "brsapi", sourceRef: "زر", sortOrder: 13 },
  { key: "fund_mesghal", category: "fund", label: "صندوق طلای مثقال", unit: "واحد", sourceType: "brsapi", sourceRef: "مثقال", sortOrder: 14 },

  // آیتم‌های دستی (بدون API - کاربر خودش قیمت رو وارد می‌کنه؛ فعلاً بدون منبع آنلاین)
  { key: "manual_fezar", category: "manual", label: "فزر", sourceType: "manual", sortOrder: 20 },
  { key: "manual_ganj", category: "manual", label: "گنج", sourceType: "manual", sortOrder: 21 },
  { key: "manual_tala_gram", category: "manual", label: "طلای آب‌شده (گرم)", unit: "گرم", sourceType: "manual", sortOrder: 22 },
];

async function main() {
  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { key: a.key },
      update: {
        category: a.category,
        label: a.label,
        unit: a.unit ?? "عدد",
        sourceType: a.sourceType,
        sourceRef: a.sourceRef,
        sortOrder: a.sortOrder ?? 0,
      },
      create: {
        key: a.key,
        category: a.category,
        label: a.label,
        unit: a.unit ?? "عدد",
        sourceType: a.sourceType,
        sourceRef: a.sourceRef,
        sortOrder: a.sortOrder ?? 0,
      },
    });
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
