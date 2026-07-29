import { Router } from "express";
import { prisma } from "../db";

export const pricesRouter = Router();

// لیست عمومی همه‌ی دارایی‌های فعال به همراه آخرین قیمت کش‌شده
// (نیازی به لاگین نداره - دقیقا مثل نسخه‌ی قبلی که قیمت‌ها عمومی نمایش داده می‌شدن)
pricesRouter.get("/", async (_req, res) => {
  const assets = await prisma.asset.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      key: true,
      category: true,
      label: true,
      unit: true,
      sourceType: true,
      currentPrice: true,
      priceUpdatedAt: true,
    },
  });
  res.json({ assets });
});
