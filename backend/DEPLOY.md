# راهنمای دیپلوی بک‌اند روی VPS

این راهنما فرض می‌کند یک VPS با اوبونتو (۲۲.۰۴ یا جدیدتر) از صفر و یک (یا هر ارائه‌دهنده‌ی دیگر) داری و از طریق SSH بهش دسترسی داری.

## ۱) نصب Node.js روی سرور

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # باید v20.x باشه
```

## ۲) کلون کردن پروژه و نصب پکیج‌ها

```bash
git clone <آدرس-ریپوی-گیت‌هاب-شما>.git
cd <پوشه‌ی-پروژه>/backend
npm ci --omit=dev  # فقط پکیج‌های production (توجه: build باید جدا انجام بشه، پایین ببین)
```

نکته: چون از TypeScript استفاده می‌کنیم، بهتره یک بار با `devDependencies` هم نصب کنی تا بتونی `npm run build` بزنی:

```bash
npm install
npm run build          # کد را از src به dist کامپایل می‌کند
```

## ۳) تنظیم فایل `.env`

```bash
cp .env.example .env
nano .env
```

مقادیر لازم:
- `JWT_SECRET` — یک رشته‌ی تصادفی بلند بساز: `openssl rand -hex 32`
- `BRSAPI_KEY` — کلیدی که از brsapi.ir گرفتی
- `CORS_ORIGINS` — دامنه/آدرس اپلیکیشن‌هایی که مجازند به API وصل بشن
- `DATABASE_URL` — می‌تونی همون `file:./prod.db` رو نگه داری (SQLite کنار کد سرور می‌مونه)

## ۴) اجرای migration ها روی دیتابیس production

```bash
npx prisma migrate deploy
npx prisma db seed
```

## ۵) اجرای دائمی سرور با PM2 (پیشنهادی)

PM2 باعث می‌شه سرور بعد از کرش یا ری‌استارت سرور، خودش دوباره بالا بیاد.

```bash
sudo npm install -g pm2
pm2 start dist/index.js --name sekeh-api
pm2 save
pm2 startup   # دستوری که خروجی می‌ده رو کپی و اجرا کن تا با boot سرور بالا بیاد
```

برای دیدن لاگ‌ها: `pm2 logs sekeh-api`
برای ری‌استارت بعد از آپدیت کد: `git pull && npm install && npm run build && pm2 restart sekeh-api`

## ۶) قرار دادن پشت Nginx + HTTPS (پیشنهادی و مهم برای پروداکشن)

بک‌اند مستقیماً روی پورت ۴۰۰۰ بالا میاد؛ برای اینکه از دامنه‌ی خودت (مثلا `api.sekeh.ir`) با HTTPS در دسترس باشه:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

یک فایل `/etc/nginx/sites-available/sekeh-api` بساز:

```nginx
server {
    listen 80;
    server_name api.sekeh.ir;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sekeh-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.sekeh.ir   # گواهی HTTPS رایگان Let's Encrypt
```

بعد از این مرحله، آدرس نهایی API شما `https://api.sekeh.ir` خواهد بود — همین را در فایل `.env` اپ موبایل به‌عنوان `EXPO_PUBLIC_API_URL` قرار بده.

## ۷) فایروال

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

(پورت ۴۰۰۰ نباید مستقیماً به دنیا باز باشه؛ فقط از طریق Nginx در دسترس باشه.)

## چک‌لیست قبل از رفتن به production

- [ ] `JWT_SECRET` تصادفی و طولانی (نه مقدار پیش‌فرض نمونه)
- [ ] `BRSAPI_KEY` واقعی ست شده (وگرنه قیمت صندوق‌ها خالی می‌مونه)
- [ ] `.env` هرگز commit نشده (در `.gitignore` هست)
- [ ] HTTPS فعال است (گوشی‌ها/Expo به HTTP ساده اعتماد سختگیرانه‌تری دارن)
- [ ] پشتیبان‌گیری دوره‌ای از فایل SQLite (`prod.db`) — یک cronjob ساده‌ی کپی به یک مسیر دیگه کافیه برای شروع
