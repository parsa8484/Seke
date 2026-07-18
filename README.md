# دفتر دارایی — طلا، سکه و صندوق

یک سایت استاتیک که قیمت طلا، سکه و صندوق‌های سرمایه‌گذاری رو هر چند ساعت خودکار
به‌روزرسانی می‌کنه (با GitHub Actions) و روی GitHub Pages نمایش می‌ده. کلید API
فقط داخل GitHub Secrets ذخیره می‌شه و هیچ‌جای عمومی دیده نمی‌شه.

## راه‌اندازی (یک‌بار)

### ۱. ساخت ریپازیتوری
یک ریپازیتوری جدید در گیت‌هاب بسازید (مثلاً `gold-tracker`) و همه‌ی فایل‌های این
پوشه رو داخلش push کنید:

```bash
git init
git add .
git commit -m "اولین نسخه"
git branch -M main
git remote add origin https://github.com/USERNAME/gold-tracker.git
git push -u origin main
```

### ۲. اضافه کردن کلید API به Secrets
1. در صفحه‌ی ریپازیتوری روی گیت‌هاب برید به:
   `Settings → Secrets and variables → Actions → New repository secret`
2. اسم: `BRSAPI_KEY`
3. مقدار: همون کلیدی که از brsapi.ir گرفتید
4. Save کنید

### ۳. فعال‌سازی GitHub Pages
1. `Settings → Pages`
2. زیر «Build and deployment» → Source رو بذارید روی `Deploy from a branch`
3. Branch رو `main` و پوشه رو `/ (root)` انتخاب کنید و Save کنید
4. بعد از چند دقیقه، آدرس سایت شما اینجا نشون داده می‌شه:
   `https://USERNAME.github.io/gold-tracker/`

### ۴. اجرای اولین به‌روزرسانی
پیش‌فرض هر ۳ ساعت خودش اجرا میشه، ولی برای اولین بار دستی اجراش کنید تا فایل
`data/prices.json` پر بشه:
1. برید به تب **Actions** در ریپازیتوری
2. روی وورک‌فلوی **Update Prices** کلیک کنید
3. دکمه‌ی **Run workflow** رو بزنید

بعد از چند ثانیه، یک کامیت جدید با قیمت‌های واقعی در `data/prices.json` می‌بینید
و سایت شما این قیمت‌ها رو نشون می‌ده.

## تنظیم صندوق‌ها

فایل `config/funds.json` رو ویرایش کنید تا صندوق مورد نظرتون اضافه بشه:

```json
[
  { "key": "gold_fund", "label": "صندوق طلا", "keyword": "طلا" }
]
```

- `key`: یک شناسه‌ی دلخواه و یکتا (فقط حروف انگلیسی)
- `label`: اسمی که روی سایت نمایش داده می‌شه
- `keyword`: بخشی از نام صندوق که در پاسخ API باید پیدا بشه

## ساختار پروژه

```
index.html              صفحه‌ی اصلی
css/style.css           استایل
js/app.js               منطق فرم و محاسبات (سمت مرورگر)
data/prices.json         داده‌ی قیمت‌ها (خودکار به‌روزرسانی می‌شه)
config/funds.json        لیست صندوق‌های مورد نظر شما
scripts/fetch_prices.py  اسکریپت پایتون که قیمت‌ها رو می‌گیره
.github/workflows/       زمان‌بندی اجرای خودکار
```

## نکته‌ی مهم درباره‌ی ساختار API

چون دسترسی مستقیم به مستندات API برای تست وجود نداشت، اسکریپت
`scripts/fetch_prices.py` با حدس زدن اسم فیلدهای رایج (`price`, `value`, `nav`
و…) قیمت رو استخراج می‌کنه. اگه بعد از اولین اجرا در تب Actions با خطا یا
مقدار `null` مواجه شدید:

1. روی اجرای وورک‌فلو در تب Actions کلیک کنید
2. لاگ کامل (شامل داده‌ی خام JSON) رو ببینید
3. اسم فیلد درست رو در `scripts/fetch_prices.py` (متغیر `PRICE_KEYS`) اضافه کنید

## اجرای محلی (اختیاری، برای تست قبل از push)

```bash
export BRSAPI_KEY="کلید-شما"
pip install requests
python scripts/fetch_prices.py
# سپس یک سرور استاتیک ساده اجرا کنید:
python -m http.server 8000
# و به http://localhost:8000 برید
```
