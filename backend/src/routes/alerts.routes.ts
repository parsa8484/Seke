import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

const MAX_ALERTS_PER_USER = 30;

function serialize(alert: any) {
  return {
    id: alert.id,
    assetKey: alert.asset.key,
    label: alert.asset.label,
    unit: alert.asset.unit,
    currentPrice: alert.asset.currentPrice,
    direction: alert.direction as "above" | "below",
    targetPrice: alert.targetPrice,
    isActive: alert.isActive,
    triggeredAt: alert.triggeredAt,
    triggeredPrice: alert.triggeredPrice,
    createdAt: alert.createdAt,
  };
}

const withAsset = {
  asset: {
    select: { key: true, label: true, unit: true, currentPrice: true },
  },
} as const;

alertsRouter.get("/", async (req: AuthedRequest, res) => {
  const alerts = await prisma.priceAlert.findMany({
    where: { userId: req.userId! },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: withAsset,
  });
  res.json({ alerts: alerts.map(serialize) });
});

const createSchema = z.object({
  assetKey: z.string().trim().min(1),
  direction: z.enum(["above", "below"]).default("above"),
  targetPrice: z
    .number()
    .positive("قیمت هدف باید بزرگ‌تر از صفر باشد")
    .max(1_000_000_000_000),
});

alertsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const userId = req.userId!;

  const count = await prisma.priceAlert.count({ where: { userId } });
  if (count >= MAX_ALERTS_PER_USER) {
    return res
      .status(400)
      .json({ error: `حداکثر ${MAX_ALERTS_PER_USER} هشدار می‌توانید بسازید` });
  }

  const asset = await prisma.asset.findUnique({
    where: { key: parsed.data.assetKey },
  });
  if (!asset) return res.status(404).json({ error: "دارایی پیدا نشد" });

  const alert = await prisma.priceAlert.create({
    data: {
      userId,
      assetId: asset.id,
      direction: parsed.data.direction,
      targetPrice: parsed.data.targetPrice,
    },
    include: withAsset,
  });
  res.status(201).json({ alert: serialize(alert) });
});

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  targetPrice: z.number().positive().max(1_000_000_000_000).optional(),
  direction: z.enum(["above", "below"]).optional(),
});

alertsRouter.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const existing = await prisma.priceAlert.findUnique({
    where: { id: req.params.id },
  });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: "هشدار پیدا نشد" });
  }

  // فعال‌کردن دوباره‌ی یک هشدار شلیک‌شده، سابقه‌ی شلیک را پاک می‌کند
  const reactivating = parsed.data.isActive === true && !existing.isActive;

  const alert = await prisma.priceAlert.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      ...(reactivating ? { triggeredAt: null, triggeredPrice: null } : {}),
    },
    include: withAsset,
  });
  res.json({ alert: serialize(alert) });
});

alertsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.priceAlert.findUnique({
    where: { id: req.params.id },
  });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: "هشدار پیدا نشد" });
  }
  await prisma.priceAlert.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ------------------------ ثبت توکن پوش‌نوتیفیکیشن ------------------------
const pushTokenSchema = z.object({
  token: z.string().trim().min(10).max(200),
  platform: z.enum(["android", "ios"]).optional(),
});

alertsRouter.post("/push-token", async (req: AuthedRequest, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  // یک دستگاه می‌تونه بین چند حساب دست‌به‌دست بشه؛ upsert روی خود توکن
  // باعث می‌شه نوتیف همیشه به صاحب فعلیِ دستگاه برسه، نه کاربر قبلی.
  await prisma.pushToken.upsert({
    where: { token: parsed.data.token },
    create: {
      token: parsed.data.token,
      platform: parsed.data.platform,
      userId: req.userId!,
    },
    update: { userId: req.userId!, platform: parsed.data.platform },
  });
  res.json({ ok: true });
});

alertsRouter.delete("/push-token/:token", async (req: AuthedRequest, res) => {
  await prisma.pushToken.deleteMany({
    where: { token: req.params.token, userId: req.userId! },
  });
  res.json({ ok: true });
});
