"""
اسکریپت به‌روزرسانی قیمت طلا، سکه و صندوق‌ها.
این فایل توسط GitHub Actions (به‌صورت زمان‌بندی‌شده) اجرا می‌شود و نتیجه را
در data/prices.json ذخیره می‌کند تا سایت استاتیک آن را نمایش دهد.

قیمت سکه‌ها مستقیم از tgju.org اسکرپ می‌شود (نیازی به کلید API نیست).
قیمت صندوق‌ها (اختیاری) از BrsApi.ir خوانده می‌شود؛ کلید آن از متغیر محیطی
BRSAPI_KEY خوانده می‌شود (در GitHub Secrets تنظیم می‌شود) و هرگز داخل کد یا
فایل خروجی نوشته نمی‌شود.
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "prices.json")
FUNDS_CONFIG_PATH = os.path.join(ROOT, "config", "funds.json")

API_KEY = os.environ.get("BRSAPI_KEY", "").strip()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8",
}

TEHRAN_TZ = timezone(timedelta(hours=3, minutes=30))
TGJU_URL = "https://www.tgju.org/"
TGJU_ROWS = {"emami": "retail_sekee", "nim": "retail_nim", "robe": "retail_rob"}


def log(msg):
    print(msg, file=sys.stderr)


def load_previous():
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"coins": {}, "funds": {}, "status": {}, "updated_at": None}


def fetch_json(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return resp.json(), None
    except requests.exceptions.RequestException as e:
        return None, f"خطای اتصال: {e}"
    except json.JSONDecodeError:
        return None, "پاسخ JSON معتبر نبود"


def find_items_containing(items, keyword):
    matches = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("cs_id") != 68:
            continue
        for value in item.values():
            if isinstance(value, str) and keyword in value:
                matches.append(item)
                break
    return matches


def extract_price(item, candidate_keys):
    for key in candidate_keys:
        if key in item and item[key] not in (None, ""):
            try:
                return float(str(item[key]).replace(",", ""))
            except (ValueError, TypeError):
                continue
    return None


def normalize_list(data):
    """داده‌ی API معمولاً یا خودش یک لیسته یا داخل یکی از کلیدهای رایج قرار داره"""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("gold", "data", "items", "result", "nav"):
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


PRICE_KEYS = ["pc", "pl", "price", "value", "nav", "final", "close", "Price", "Value", "NAV", "Final", "Close"]


def fetch_coin_prices_from_tgju():
    """قیمت سکه‌ها رو مستقیم از صفحه‌ی اصلی tgju.org اسکرپ می‌کنه."""
    try:
        resp = requests.get(TGJU_URL, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        return {}, f"خطای اتصال به tgju.org: {e}"

    soup = BeautifulSoup(resp.text, "html.parser")
    prices = {}
    missing = []

    for key, row_name in TGJU_ROWS.items():
        row = soup.find("tr", {"data-market-row": row_name})
        if row is None:
            missing.append(row_name)
            continue
        cell = row.find("td", class_="nf")
        if cell is None:
            missing.append(row_name)
            continue
        try:
            prices[key] = int(cell.text.strip().replace(",", "")) / 10000
        except ValueError:
            missing.append(row_name)

    if missing:
        return prices, f"ردیف(های) {', '.join(missing)} پیدا نشد (ساختار سایت شاید تغییر کرده)"
    return prices, None


def main():
    previous = load_previous()
    now = datetime.now(TEHRAN_TZ).isoformat()

    result = {
        "updated_at": now,
        "coins": dict(previous.get("coins", {})),
        "funds": dict(previous.get("funds", {})),
        "status": {},
    }

    # ---------- طلا و سکه (از tgju.org) ----------
    coin_prices, err = fetch_coin_prices_from_tgju()
    result["coins"].update(coin_prices)

    if err and not coin_prices:
        log(f"خطا در دریافت طلا/سکه: {err}")
        result["status"]["coins"] = f"error: {err}"
    elif err:
        log(f"⚠️  {err}")
        result["status"]["coins"] = f"partial ({len(coin_prices)}/{len(TGJU_ROWS)})"
    else:
        result["status"]["coins"] = "ok"

    # ---------- صندوق‌ها (اختیاری، از BrsApi.ir) ----------
    try:
        with open(FUNDS_CONFIG_PATH, "r", encoding="utf-8") as f:
            funds_config = json.load(f)
    except (OSError, json.JSONDecodeError):
        funds_config = []

    if not API_KEY:
        log("⚠️  BRSAPI_KEY تنظیم نشده؛ به‌روزرسانی صندوق‌ها رد می‌شود.")
        result["status"]["funds"] = "skipped: no BRSAPI_KEY"
    else:
        nav_url = f"https://BrsApi.ir/Api/Tsetmc/AllSymbols.php?key={API_KEY}&type=1"
        nav_data, err = fetch_json(nav_url)

        if err:
            log(f"خطا در دریافت صندوق‌ها: {err}")
            result["status"]["funds"] = f"error: {err}"
        else:
            items = normalize_list(nav_data)
            ok_count = 0
            for fund in funds_config:
                matches = find_items_containing(items, fund["keyword"])
                if matches:
                    price = extract_price(matches[0], PRICE_KEYS)
                    if price is not None:
                        result["funds"][fund["key"]] = {
                            "label": fund["label"],
                            "price": price,
                        }
                        ok_count += 1
                        continue
                log(f"⚠️  صندوق با کلیدواژه‌ی '{fund['keyword']}' پیدا نشد.")
            result["status"]["funds"] = "ok" if ok_count == len(funds_config) else f"partial ({ok_count}/{len(funds_config)})"

    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log("نتیجه ذخیره شد:")
    log(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
