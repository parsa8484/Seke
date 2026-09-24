import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { ackRestore, getRestoreItems } from "../services/restoreStore";

/**
 * بازیابیِ موقتِ دارایی‌های چند کاربر — توضیح کامل در services/restoreStore.ts.
 * هر کاربر فقط ورودیِ خودش را می‌بیند (userId از توکن می‌آید، نه از ورودی).
 */
export const restoreRouter = Router();
restoreRouter.use(requireAuth);

restoreRouter.get("/holdings", (req: AuthedRequest, res) => {
  try {
    res.json({ items: getRestoreItems(req.userId!) });
  } catch (err) {
    console.error("restore read failed:", err);
    // ۵۰۰ و نه «خالی»: اپ خالی را یعنی «چیزی نیست» می‌فهمد، خطا را یعنی «بعداً»
    res.status(500).json({ error: "خواندن اطلاعات بازیابی ممکن نشد" });
  }
});

const ackSchema = z.object({ keys: z.array(z.string().min(1)).max(200) });

// اپ بعد از اینکه دارایی‌ها را روی گوشی نوشت و دوباره از دیسک خواند، اینجا
// نمادهای نوشته‌شده را می‌فرستد تا نسخه‌ی سرور پاک شود.
restoreRouter.post("/holdings/ack", (req: AuthedRequest, res) => {
  const parsed = ackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "ورودی نامعتبر است" });
  }
  try {
    const result = ackRestore(req.userId!, parsed.data.keys);
    if (result === "mismatch") {
      return res
        .status(409)
        .json({ error: "همه‌ی نمادها تأیید نشده‌اند؛ چیزی پاک نشد" });
    }
    res.json({ ok: true, result });
  } catch (err) {
    console.error("restore ack failed:", err);
    res.status(500).json({ error: "پاک کردن نسخه‌ی سرور ممکن نشد" });
  }
});
