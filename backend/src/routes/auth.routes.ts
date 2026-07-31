import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

// ثبت تلاش ورود (موفق یا ناموفق) برای نمایش در تاریخچه‌ی امنیتی کاربر.
// عمداً throw نمی‌کنه: اگه لاگ‌کردن شکست خورد نباید جلوی ورود کاربر گرفته بشه.
async function recordLoginEvent(
  userId: string,
  success: boolean,
  req: { ip?: string; headers: Record<string, any> }
) {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const ipAddress =
      (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
      req.ip ||
      null;
    await prisma.loginEvent.create({
      data: {
        userId,
        success,
        ipAddress,
        userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) || null,
      },
    });
  } catch (err) {
    console.error("[auth] ثبت تاریخچه‌ی ورود شکست خورد:", (err as Error).message);
  }
}

// SQLite در Prisma حالت insensitive نداره، پس مقایسه‌ی بدون حساسیت به
// بزرگی/کوچکی حروف رو با LOWER() در کوئری خام انجام می‌دیم (پارامتری و امن).
async function findUserByUsername(username: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE username IS NOT NULL AND LOWER(username) = LOWER(${username})
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return prisma.user.findUnique({ where: { id: rows[0].id } });
}

// نام کاربری: حروف/عدد انگلیسی و _ و . — بدون فاصله، تا با ایمیل اشتباه نشه
const usernameSchema = z
  .string()
  .trim()
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
  .max(30, "نام کاربری حداکثر ۳۰ کاراکتر است")
  .regex(
    /^[a-zA-Z0-9._]+$/,
    "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه و زیرخط باشد"
  );

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست"),
  username: usernameSchema,
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  displayName: z.string().trim().min(1).max(60).optional(),
});

// ورود با ایمیل یا نام کاربری — هر دو در همین یک فیلد پذیرفته می‌شن
const loginSchema = z.object({
  identifier: z.string().trim().min(1, "ایمیل یا نام کاربری را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, username, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "این ایمیل قبلاً ثبت‌نام کرده است" });
  }

  // نام کاربری بدون حساسیت به بزرگی/کوچکی حرف یکتاست تا "Ali" و "ali" یکی حساب بشن
  const usernameTaken = await findUserByUsername(username);
  if (usernameTaken) {
    return res.status(409).json({ error: "این نام کاربری قبلاً گرفته شده است" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, username, passwordHash, displayName: displayName ?? username },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { identifier, password } = parsed.data;

  // اگر شبیه ایمیل بود با ایمیل بگرد، وگرنه با نام کاربری
  const user = identifier.includes("@")
    ? await prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
      })
    : await findUserByUsername(identifier);

  const invalidCredentials = "ایمیل/نام کاربری یا رمز عبور اشتباه است";
  if (!user) {
    return res.status(401).json({ error: invalidCredentials });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordLoginEvent(user.id, false, req);
    return res.status(401).json({ error: invalidCredentials });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "حساب شما غیرفعال شده است" });
  }

  await recordLoginEvent(user.id, true, req);

  const token = signToken({ userId: user.id, email: user.email });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

// اطلاعات کاربر لاگین‌کرده (برای چک‌کردن اعتبار توکن هنگام باز شدن اپ)
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "کاربر پیدا نشد" });
  if (!user.isActive) {
    return res.status(403).json({ error: "حساب شما غیرفعال شده است" });
  }
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "رمز عبور فعلی را وارد کنید"),
  newPassword: z.string().min(6, "رمز جدید باید حداقل ۶ کاراکتر باشد"),
});

// تغییر رمز عبور توسط خود کاربر (نیازمند دانستن رمز فعلی)
authRouter.post(
  "/change-password",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "کاربر پیدا نشد" });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "رمز عبور فعلی اشتباه است" });
    }
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({ error: "رمز جدید نباید با رمز فعلی یکسان باشد" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return res.json({ ok: true, message: "رمز عبور با موفقیت تغییر کرد" });
  }
);

// پروفایل: تغییر نام نمایشی
const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
});

authRouter.patch("/profile", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { displayName: parsed.data.displayName },
  });
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

// تاریخچه‌ی ورود‌های اخیر همین کاربر
authRouter.get("/login-history", requireAuth, async (req: AuthedRequest, res) => {
  const events = await prisma.loginEvent.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      success: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
    },
  });
  return res.json({ events });
});
