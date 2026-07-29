import { PrismaClient } from "@prisma/client";

// یک instance مشترک از Prisma در کل اپ (جلوگیری از باز شدن چندین اتصال)
export const prisma = new PrismaClient();
