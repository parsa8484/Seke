import { Response, NextFunction } from "express";
import { prisma } from "../db";
import { AuthedRequest } from "./auth";

// باید بعد از requireAuth استفاده بشه. نقش کاربر رو هر بار تازه از دیتابیس
// می‌خونه (نه از JWT) تا تغییر نقش/غیرفعال‌سازی بلافاصله اثر کنه.
export async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || !user.isActive || user.role !== "admin") {
    return res.status(403).json({ error: "دسترسی غیرمجاز" });
  }
  next();
}
