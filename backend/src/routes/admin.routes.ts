import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { hashPassword } from "../utils/password";
import { refreshPrices } from "../services/priceService";
import { config } from "../config";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// ----------------------------- آمار کلی -----------------------------
adminRouter.get("/stats", async (_req, res) => {
  const [userCount, activeUserCount, holdingCount, assets, holdings] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.holding.count(),
      prisma.asset.findMany(),
      prisma.holding.findMany({ include: { asset: true } }),
    ]);

  const totalHoldingsValue = holdings.reduce(
    (sum, h) => sum + h.quantity * (h.asset.currentPrice ?? 0),
    0
  );

  const assetsMissingPrice = assets
    .filter((a) => a.isActive && a.sourceType !== "manual" && a.currentPrice === null)
    .map((a) => ({ key: a.key, label: a.label }));

  res.json({
    userCount,
    activeUserCount,
    holdingCount,
    totalHoldingsValue,
    assetsMissingPrice,
    brsapiConfigured: Boolean(config.brsapiKey),
  });
});

// ----------------------------- بروزرسانی دستی قیمت‌ها -----------------------------
adminRouter.post("/prices/refresh", async (_req, res) => {
  try {
    const result = await refreshPrices();
    res.json({ ok: true, ...result });
  } catch {
    res.status(500).json({ error: "خطا در دریافت قیمت‌ها" });
  }
});

// ----------------------------- مدیریت کاربران -----------------------------
adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { holdings: true } } },
  });
  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      holdingsCount: u._count.holdings,
    })),
  });
});

adminRouter.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { holdings: { include: { asset: true } } },
  });
  if (!user) return res.status(404).json({ error: "کاربر پیدا نشد" });

  const holdings = user.holdings
    .filter((h) => h.quantity > 0)
    .map((h) => ({
      assetKey: h.asset.key,
      label: h.asset.label,
      quantity: h.quantity,
      price: h.asset.currentPrice,
      value: h.quantity * (h.asset.currentPrice ?? 0),
    }));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
    holdings,
    totalValue: holdings.reduce((s, h) => s + h.value, 0),
  });
});

const updateUserSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  isActive: z.boolean().optional(),
});

adminRouter.put("/users/:id", async (req: AuthedRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  if (req.params.id === req.userId) {
    return res
      .status(400)
      .json({ error: "نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید" });
  }

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "کاربر پیدا نشد" });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({
    user: {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      isActive: updated.isActive,
    },
  });
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "رمز جدید باید حداقل ۶ کاراکتر باشد"),
});

// ریست رمز عبور یک کاربر توسط ادمین — بدون نیاز به دانستن رمز فعلی.
// برخلاف تغییر نقش، ادمین اجازه داره رمز خودش رو هم از اینجا عوض کنه.
adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "کاربر پیدا نشد" });

  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  res.json({
    ok: true,
    message: `رمز عبور ${existing.username ?? existing.email} تغییر کرد`,
  });
});

// تاریخچه‌ی ورود یک کاربر — برای بررسی فعالیت مشکوک توسط ادمین
adminRouter.get("/users/:id/login-history", async (req, res) => {
  const events = await prisma.loginEvent.findMany({
    where: { userId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      success: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });
  res.json({ events });
});

adminRouter.delete("/users/:id", async (req: AuthedRequest, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: "نمی‌توانید حساب خودتان را حذف کنید" });
  }
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "کاربر پیدا نشد" });

  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ----------------------------- مدیریت کاتالوگ دارایی‌ها -----------------------------
adminRouter.get("/assets", async (_req, res) => {
  const assets = await prisma.asset.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  res.json({ assets });
});

const assetSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "کلید فقط می‌تواند شامل حروف کوچک لاتین، عدد و _ باشد"),
  category: z.string().trim().min(2).max(30),
  label: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(20).default("عدد"),
  sourceType: z.enum(["tgju", "brsapi", "manual"]),
  sourceRef: z.string().trim().max(80).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

adminRouter.post("/assets", async (req, res) => {
  const parsed = assetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const existing = await prisma.asset.findUnique({
    where: { key: parsed.data.key },
  });
  if (existing) {
    return res.status(409).json({ error: "این کلید قبلاً استفاده شده است" });
  }
  const asset = await prisma.asset.create({ data: parsed.data });
  res.status(201).json({ asset });
});

const assetUpdateSchema = assetSchema.partial().extend({
  isActive: z.boolean().optional(),
});

adminRouter.put("/assets/:id", async (req, res) => {
  const parsed = assetUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "دارایی پیدا نشد" });

  if (parsed.data.key && parsed.data.key !== existing.key) {
    const dup = await prisma.asset.findUnique({ where: { key: parsed.data.key } });
    if (dup) return res.status(409).json({ error: "این کلید قبلاً استفاده شده است" });
  }

  const asset = await prisma.asset.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json({ asset });
});

adminRouter.delete("/assets/:id", async (req, res) => {
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "دارایی پیدا نشد" });
  await prisma.asset.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

const priceSchema = z.object({
  price: z.number().positive().max(1_000_000_000_000),
});

// تعیین دستی قیمت - مخصوص دارایی‌های sourceType=manual (که API ندارن)
// ولی روی هر دارایی دیگه‌ای هم قابل استفاده‌ست (override موقت)
adminRouter.put("/assets/:id/price", async (req, res) => {
  const parsed = priceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "دارایی پیدا نشد" });

  const asset = await prisma.asset.update({
    where: { id: req.params.id },
    data: { currentPrice: parsed.data.price, priceUpdatedAt: new Date() },
  });
  await prisma.priceHistory.create({
    data: { assetId: asset.id, price: parsed.data.price },
  });
  res.json({ asset });
});
