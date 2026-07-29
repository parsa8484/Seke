# Sekeh Backend

بک‌اند اپلیکیشن «دارایی من» — احراز هویت، ذخیره‌ی دارایی‌های کاربر (سکه/صندوق طلا)، و قیمت‌های آنلاین.

## استک
- Node.js + Express + TypeScript
- SQLite (از طریق Prisma ORM)
- JWT برای احراز هویت (ایمیل + رمز عبور، هش با bcrypt)
- قیمت‌ها: اسکرِیپ tgju.org (سکه) + BrsApi.ir (صندوق‌های طلا)، کش‌شده در دیتابیس و رفرش دوره‌ای

## اجرای محلی (development)

```bash
npm install
cp .env.example .env
# .env رو ویرایش کن: حداقل JWT_SECRET رو عوض کن

npx prisma migrate dev   # ساخت جدول‌ها + اجرای seed کاتالوگ دارایی‌ها
npm run dev              # اجرای سرور با ری‌استارت خودکار روی تغییر فایل
```

سرور روی `http://localhost:4000` بالا میاد. تست سلامت: `curl http://localhost:4000/health`

## مسیرهای API

| Method | مسیر | توضیح | نیاز به توکن |
|---|---|---|---|
| POST | `/api/auth/register` | ثبت‌نام (email, password, displayName?) | خیر |
| POST | `/api/auth/login` | ورود (email, password) | خیر |
| GET  | `/api/auth/me` | اطلاعات کاربر لاگین‌شده | بله |
| GET  | `/api/prices` | لیست عمومی همه‌ی دارایی‌ها با آخرین قیمت | خیر |
| GET  | `/api/holdings/summary` | دارایی‌های کاربر + قیمت + ارزش هرکدام + جمع کل | بله |
| PUT  | `/api/holdings` | ذخیره‌ی دسته‌جمعی تعداد دارایی‌ها | بله |

توکن باید در هدر `Authorization: Bearer <token>` ارسال بشه.

## اضافه‌کردن دارایی جدید (مثلا نقره)

کافیه یک ردیف به `prisma/seed.ts` اضافه کنی (کلید یکتا، دسته‌بندی، منبع قیمت) و
`npx prisma db seed` رو دوباره اجرا کنی — نیازی به migration یا تغییر کد نیست.
اگر منبع قیمتش جدیده (نه tgju/BrsApi)، باید یک fetcher کوچیک در
`src/services/priceService.ts` اضافه بشه.

## دیپلوی

راهنمای کامل دیپلوی روی VPS در [DEPLOY.md](./DEPLOY.md).
