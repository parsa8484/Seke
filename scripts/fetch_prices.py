"""
اسکریپت به‌روزرسانی قیمت طلا، سکه و صندوق‌ها.
این فایل توسط GitHub Actions (به‌صورت زمان‌بندی‌شده) اجرا می‌شود و نتیجه را
در data/prices.json ذخیره می‌کند تا سایت استاتیک آن را نمایش دهد.

کلید API از متغیر محیطی BRSAPI_KEY خوانده می‌شود (در GitHub Secrets تنظیم می‌شود)
و هرگز داخل کد یا فایل خروجی نوشته نمی‌شود.
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "prices.json")
FUNDS_CONFIG_PATH = os.path.join(ROOT, "config", "funds.json")

API_KEY = os.environ.get("BRSAPI_KEY", "").strip()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
}

TEHRAN_TZ = timezone(timedelta(hours=3, minutes=30))


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


def fetch_json(url, label):
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


PRICE_KEYS = ["price", "value", "nav", "pl", "final", "close", "Price", "Value", "NAV", "Final", "Close"]


def main():
    if not API_KEY:
        log("⚠️  BRSAPI_KEY تنظیم نشده. از GitHub Secrets استفاده کنید.")

    previous = load_previous()
    now = datetime.now(TEHRAN_TZ).isoformat()

    result = {
        "updated_at": now,
        "coins": dict(previous.get("coins", {})),
        "funds": dict(previous.get("funds", {})),
        "status": {},
    }

    # ---------- طلا و سکه ----------
    gold_url = f"https://Api.BrsApi.ir/Market/Gold_Currency_Pro.php?key={API_KEY}&section=gold"
    gold_data, err = fetch_json(gold_url, "Gold_Currency_Pro")

    if err:
        log(f"خطا در دریافت طلا/سکه: {err}")
        result["status"]["coins"] = f"error: {err}"
    else:
        items = normalize_list(gold_data)
        coin_map = {"emami": "امامی", "nim": "نیم", "robe": "ربع"}
        ok_count = 0
        for key, keyword in coin_map.items():
            matches = find_items_containing(items, keyword)
            if matches:
                price = extract_price(matches[0], PRICE_KEYS)
                if price is not None:
                    result["coins"][key] = price / 10000
                    ok_count += 1
                    continue
            log(f"⚠️  قیمت '{keyword}' پیدا نشد.")
        result["status"]["coins"] = "ok" if ok_count == len(coin_map) else f"partial ({ok_count}/{len(coin_map)})"

    # ---------- صندوق‌ها ----------
    try:
        with open(FUNDS_CONFIG_PATH, "r", encoding="utf-8") as f:
            funds_config = json.load(f)
    except (OSError, json.JSONDecodeError):
        funds_config = []

    nav_url = f"https://BrsApi.ir/Api/Tsetmc/Nav.php?key={API_KEY}"
    nav_data, err = fetch_json(nav_url, "Nav ETF")

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
