# دارایی من (Sekeh)

اپلیکیشن ردیابی دارایی سکه، طلا و صندوق طلا — با قیمت‌های آنلاین لحظه‌ای.

نسخه‌ی قبلی این پروژه یک صفحه‌ی استاتیک روی GitHub Pages بود
(https://parsa8484.github.io/Seke/). این نسخه‌ی جدید شامل یک بک‌اند واقعی با
دیتابیس و احراز هویت + یک اپ موبایل حرفه‌ای (React Native / Expo) است.

## ساختار پروژه

```
Daraei/
  backend/    API با Node.js + Express + TypeScript + SQLite (Prisma) + JWT
  mobile/     اپ موبایل با React Native (Expo) + TypeScript + Expo Router
```

هر پوشه README مخصوص خودش رو داره:
- [backend/README.md](./backend/README.md) — اجرا، مسیرهای API، افزودن دارایی جدید
- [backend/DEPLOY.md](./backend/DEPLOY.md) — دیپلوی روی VPS
- [mobile/README.md](./mobile/README.md) — اجرا، تست روی گوشی، ساخت APK برای مایکت

## شروع سریع (development)

```bash
# ترمینال ۱: بک‌اند
cd backend
npm install
cp .env.example .env      # JWT_SECRET رو عوض کن
npx prisma migrate dev
npm run dev

# ترمینال ۲: اپ موبایل
cd mobile
npm install
cp .env.example .env      # EXPO_PUBLIC_API_URL رو با IP لوکالت پر کن
npx expo start
```

سپس با اپ **Expo Go** روی گوشی، QR Code رو اسکن کن.

## وضعیت فعلی

- [x] ثبت‌نام / ورود با ایمیل و رمز عبور (JWT)
- [x] ذخیره‌ی دائمی تعداد دارایی‌های هر کاربر (SQLite)
- [x] قیمت آنلاین سکه (امامی/نیم/ربع) از tgju.org
- [x] قیمت صندوق‌های طلا از BrsApi (نیاز به کلید API - `BRSAPI_KEY`)
- [x] محاسبه‌ی ارزش نقدی لحظه‌ای کل دارایی‌ها
- [ ] قیمت نقره و صندوق‌های نقره (کاتالوگ آماده‌ست، فقط باید منبع قیمت وصل بشه)
- [ ] دیپلوی بک‌اند روی VPS production
- [ ] ساخت APK نهایی و انتشار در مایکت
