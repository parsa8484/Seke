# Sekeh Mobile (دارایی من)

اپ موبایل React Native (Expo + TypeScript + Expo Router) برای ثبت دارایی‌های
سکه/طلا/صندوق و محاسبه‌ی لحظه‌ای ارزش نقدی آن‌ها.

## پیش‌نیاز
بک‌اند (پوشه‌ی `../backend`) باید از قبل بالا باشه: `npm run dev` در اون پوشه.

## اجرای محلی

```bash
npm install
cp .env.example .env
```

فایل `.env` رو باز کن و `EXPO_PUBLIC_API_URL` رو با IP شبکه‌ی محلی کامپیوترت
تنظیم کن (نه `localhost` — چون گوشی یک دستگاه جداست و باید از طریق Wi-Fi به
کامپیوترت وصل بشه). IP رو با `ipconfig` (ویندوز) پیدا کن، دنبال
"IPv4 Address" زیر آداپتور Wi-Fi بگرد.

```bash
npx expo start
```

یک QR Code توی ترمینال نشون داده می‌شه.

## تست روی گوشی واقعی (ساده‌ترین راه)

۱. اپ **Expo Go** رو از Google Play (اندروید) یا App Store (iOS) نصب کن.
۲. مطمئن شو گوشی و کامپیوتر روی **یک شبکه‌ی Wi-Fi** هستن.
۳. با اپ Expo Go، QR Code بالا رو اسکن کن.
۴. اپ لود می‌شه و صفحه‌ی ورود رو می‌بینی.

## تست روی شبیه‌ساز اندروید (اگر Android Studio نصب داری)

```bash
npx expo start --android
```

## ساخت APK برای انتشار در مایکت

برای اینکه اپ رو مستقل از Expo Go و به‌صورت یک فایل نصبی واقعی (APK) دربیاری،
از EAS Build استفاده می‌کنیم (سرویس رایگان/ارزان خود Expo برای بیلد):

```bash
npm install -g eas-cli
eas login          # با اکانت Expo (رایگان بساز)
eas build:configure
eas build --platform android --profile preview
```

بعد از چند دقیقه یک لینک دانلود APK می‌گیری که مستقیم قابل نصب روی گوشیه و
همون فایل رو می‌تونی توی مایکت آپلود کنی. قبلش حتماً:

- `app.json` → `expo.android.package` رو به یک شناسه‌ی یکتای واقعی تغییر بده
  (فعلاً `ir.sekeh.app` گذاشته شده - اگه اسم نهایی برند عوض شد این‌جا هم عوض کن)
- `EXPO_PUBLIC_API_URL` در `.env` باید به آدرس **واقعی سرور production**
  (بعد از دیپلوی بک‌اند روی VPS طبق `backend/DEPLOY.md`) اشاره کنه، نه IP لوکال —
  چون این مقدار در زمان build داخل اپ کامپایل می‌شه.

## ساختار پروژه

```
app/
  _layout.tsx          ریشه: Providerهای React Query و Auth
  (auth)/               صفحات قبل از ورود
    login.tsx
    register.tsx
  (app)/                صفحات بعد از ورود (تب‌ها)
    _layout.tsx
    index.tsx            داشبورد دارایی‌ها
    settings.tsx          پروفایل و خروج
src/
  api/                  کلاینت axios + توابع فراخوانی بک‌اند
  context/AuthContext.tsx  نگه‌داری توکن (SecureStore) و وضعیت کاربر
  components/            کامپوننت‌های مشترک UI
  theme/colors.ts         رنگ‌ها و فاصله‌های تم (تیره + طلایی)
```
