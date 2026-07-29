# دارایی من (Sekeh)

اپلیکیشن ردیابی دارایی سکه، طلا و صندوق طلا — با قیمت‌های آنلاین لحظه‌ای.

نسخه‌ی اول این پروژه یک صفحه‌ی استاتیک ساده بود که مستقیم روی GitHub Pages
همین ریپو منتشر می‌شد (فایل‌های `index.html`، `css/`، `js/`، `data/`،
`scripts/` در ریشه‌ی ریپو). مستندات اون نسخه در [WEB_LEGACY.md](./WEB_LEGACY.md)
نگه داشته شده و همچنان روی GitHub Pages فعاله.

نسخه‌ی فعلی (این README) شامل یک بک‌اند واقعی با دیتابیس و احراز هویت + یک اپ
موبایل حرفه‌ای (React Native / Expo) با پنل مدیریت ادمین داخل خودِ اپ است.

## ساختار پروژه

```
backend/    API با Node.js + Express + TypeScript + SQLite (Prisma) + JWT
mobile/     اپ موبایل با React Native (Expo) + TypeScript + Expo Router
```

فایل‌های ریشه (`index.html`, `css/`, `js/`, `data/`, `config/`, `scripts/`,
`.github/workflows/`) مربوط به نسخه‌ی قدیمی سایت استاتیک هستن و دست‌نخورده
باقی موندن تا GitHub Pages بشکنه نشه.

هر پوشه README مخصوص خودش رو داره:
- [backend/README.md](./backend/README.md) — اجرا، مسیرهای API، افزودن دارایی جدید
- [backend/DEPLOY.md](./backend/DEPLOY.md) — دیپلوی روی VPS
- [mobile/README.md](./mobile/README.md) — اجرا، تست روی گوشی، ساخت APK برای مایکت

## شروع سریع (development)

```bash
# ترمینال ۱: بک‌اند
cd backend
npm install
cp .env.example .env      # JWT_SECRET و BRSAPI_KEY رو تنظیم کن
npx prisma migrate dev
npm run dev

# ترمینال ۲: اپ موبایل
cd mobile
npm install
cp .env.example .env      # EXPO_PUBLIC_API_URL رو با IP لوکالت پر کن
npx expo start
```

سپس با اپ **Expo Go** روی گوشی، QR Code رو اسکن کن.

### ساختن اولین ادمین

بعد از این‌که یک‌بار از داخل اپ ثبت‌نام کردی، از داخل پوشه‌ی `backend`:

```bash
npm run make-admin -- your@email.com
```

بعد از لاگین مجدد، یک تب «مدیریت» در اپ ظاهر می‌شه که شامل آمار کلی، مدیریت
کاربران (تغییر نقش/فعال‌سازی/حذف) و مدیریت کاتالوگ دارایی‌ها (افزودن دارایی
جدید، تعیین قیمت دستی، بروزرسانی دستی قیمت‌های آنلاین) است.

## وضعیت فعلی

- [x] ثبت‌نام / ورود با ایمیل و رمز عبور (JWT)
- [x] ذخیره‌ی دائمی تعداد دارایی‌های هر کاربر (SQLite)
- [x] قیمت آنلاین سکه (امامی/نیم/ربع) از tgju.org
- [x] قیمت صندوق‌های طلا از BrsApi (نیاز به کلید API - `BRSAPI_KEY`)
- [x] محاسبه‌ی ارزش نقدی لحظه‌ای کل دارایی‌ها
- [x] پنل مدیریت ادمین داخل اپ (کاربران، کاتالوگ دارایی‌ها، آمار، رفرش دستی قیمت)
- [ ] قیمت نقره و صندوق‌های نقره (کاتالوگ آماده‌ست، فقط باید منبع قیمت وصل بشه)
- [ ] دیپلوی بک‌اند روی VPS production
- [ ] ساخت APK نهایی و انتشار در مایکت
