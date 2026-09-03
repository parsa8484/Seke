import { prisma } from "../src/db";
import { hashPassword } from "../src/utils/password";

// ست کردن رمز جدید برای یک کاربر از خط فرمان (وقتی رمز ادمین فراموش شده).
// استفاده: npm run reset-password -- you@example.com NewPass123
(async () => {
  const [identifier, newPassword] = process.argv.slice(2);
  if (!identifier || !newPassword) {
    console.error("استفاده: npm run reset-password -- email-or-username NewPass123");
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error("رمز باید حداقل ۶ کاراکتر باشد.");
    process.exit(1);
  }

  const key = identifier.trim().toLowerCase();
  const user = key.includes("@")
    ? await prisma.user.findUnique({ where: { email: key }, select: { id: true } })
    : (
        await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM users
          WHERE username IS NOT NULL AND LOWER(username) = LOWER(${key})
          LIMIT 1
        `
      )[0] ?? null;

  if (!user) {
    console.error(`کاربری با «${identifier}» پیدا نشد. اول npm run list-users را بزن.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  console.log(`✅ رمز کاربر ${identifier} عوض شد.`);
})().finally(() => prisma.$disconnect());
