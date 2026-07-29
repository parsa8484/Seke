import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// اسکریپت یک‌باره برای ارتقای یک کاربر (که قبلاً از داخل اپ ثبت‌نام کرده)
// به نقش ادمین. استفاده: npm run make-admin -- you@example.com
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("استفاده: npm run make-admin -- you@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`کاربری با ایمیل ${email} پیدا نشد. اول باید داخل اپ ثبت‌نام کنه.`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: "admin" },
  });
  console.log(`✅ کاربر ${updated.email} حالا ادمین است`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
