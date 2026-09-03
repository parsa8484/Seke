import { prisma } from "../src/db";

// نمایش کاربران ثبت‌شده (بدون رمز — رمزها هش شده‌اند و قابل بازیابی نیستند).
// استفاده: npm run list-users
(async () => {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (users.length === 0) {
    console.log("هیچ کاربری در این دیتابیس نیست.");
    return;
  }
  for (const u of users) {
    console.log(
      `${u.role === "admin" ? "👑" : "  "} ${u.email}` +
        ` | username: ${u.username ?? "-"}` +
        ` | name: ${u.displayName ?? "-"}` +
        ` | active: ${u.isActive}` +
        ` | ${u.createdAt.toISOString().slice(0, 10)}`
    );
  }
})().finally(() => prisma.$disconnect());
