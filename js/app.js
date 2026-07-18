// ==========================================
// تعریف اقلام
// ==========================================
const COIN_ITEMS = [
  { key: "emami", label: "سکه امامی (تمام)" },
  { key: "nim", label: "نیم سکه" },
  { key: "robe", label: "ربع سکه" },
];

// اقلامی که قیمتشون از API نمیاد و باید دستی وارد بشه
// quantity و price پیش‌فرض فقط اولین بار (وقتی هنوز چیزی در localStorage نیست) استفاده می‌شن
const MANUAL_ITEMS = [
  { key: "kahroba", label: "کهربا", defaultQty: 0, defaultPrice: 15700 },
  { key: "fezar", label: "فزر", defaultQty: 0, defaultPrice: 7900 },
  { key: "zar", label: "زر", defaultQty: 0, defaultPrice: 41950 },
  { key: "ganj", label: "گنج", defaultQty: 0, defaultPrice: 13780 },
  { key: "tala", label: "طلای آب‌شده (گرم)", defaultQty: 7.23, defaultPrice: 19000 },
];

const STORAGE_PREFIX = "gold-tracker:";

// ==========================================
// کمک‌تابع‌ها
// ==========================================
function fa(num) {
  const n = Number.isFinite(num) ? num : 0;
  return n.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
}

function getStored(key, fallback) {
  const raw = localStorage.getItem(STORAGE_PREFIX + key);
  if (raw === null) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setStored(key, value) {
  localStorage.setItem(STORAGE_PREFIX + key, String(value));
}

function makeRow({ label, qty, qtyEditable, price, priceEditable, onQtyChange, onPriceChange }) {
  const row = document.createElement("div");
  row.className = "row";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = label;

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.step = "any";
  qtyInput.value = qty;
  qtyInput.disabled = !qtyEditable;
  qtyInput.addEventListener("input", () => onQtyChange(parseFloat(qtyInput.value) || 0));

  const priceSpan = document.createElement(priceEditable ? "input" : "span");
  priceSpan.className = "unit-price";
  if (priceEditable) {
    priceSpan.type = "number";
    priceSpan.step = "any";
    priceSpan.value = price;
    priceSpan.addEventListener("input", () => onPriceChange(parseFloat(priceSpan.value) || 0));
  } else {
    priceSpan.textContent = price === null ? "—" : fa(price);
  }

  const subtotal = document.createElement("span");
  subtotal.className = "subtotal";

  row.append(name, qtyInput, priceSpan, subtotal);
  return { row, subtotal, qtyInput, priceSpan };
}

// ==========================================
// رندر بخش زنده (سکه + صندوق‌ها)
// ==========================================
function renderLive(prices) {
  const container = document.getElementById("live-rows");
  container.innerHTML = "";
  let liveTotal = 0;

  const items = [...COIN_ITEMS];
  const funds = prices.funds || {};
  Object.keys(funds).forEach((key) => {
    items.push({ key: `fund_${key}`, label: funds[key].label, isFund: true, fundKey: key });
  });

  items.forEach((item) => {
    const price = item.isFund
      ? funds[item.fundKey].price
      : (prices.coins ? prices.coins[item.key] : null);

    const qtyKey = `qty_${item.key}`;
    let qty = getStored(qtyKey, 0);

    const { row, subtotal } = makeRow({
      label: item.label,
      qty,
      qtyEditable: true,
      price: price,
      priceEditable: false,
      onQtyChange: (val) => {
        qty = val;
        setStored(qtyKey, qty);
        update(prices);
      },
    });

    const value = (price || 0) * qty;
    subtotal.textContent = fa(value);
    liveTotal += value;

    container.appendChild(row);
  });

  document.getElementById("live-total").textContent = fa(liveTotal);
  return liveTotal;
}

// ==========================================
// رندر بخش دستی
// ==========================================
function renderManual() {
  const container = document.getElementById("manual-rows");
  container.innerHTML = "";
  let manualTotal = 0;

  MANUAL_ITEMS.forEach((item) => {
    const qtyKey = `qty_${item.key}`;
    const priceKey = `price_${item.key}`;
    let qty = getStored(qtyKey, item.defaultQty);
    let price = getStored(priceKey, item.defaultPrice);

    const { row, subtotal } = makeRow({
      label: item.label,
      qty,
      qtyEditable: true,
      price,
      priceEditable: true,
      onQtyChange: (val) => {
        qty = val;
        setStored(qtyKey, qty);
        refreshAll();
      },
      onPriceChange: (val) => {
        price = val;
        setStored(priceKey, price);
        refreshAll();
      },
    });

    const value = qty * price;
    subtotal.textContent = fa(value);
    manualTotal += value;

    container.appendChild(row);
  });

  document.getElementById("manual-total").textContent = fa(manualTotal);
  return manualTotal;
}

// ==========================================
// تازگی داده
// ==========================================
function renderFreshness(updatedAt) {
  const dot = document.getElementById("freshness-dot");
  const text = document.getElementById("freshness-text");

  if (!updatedAt) {
    dot.classList.add("stale");
    text.textContent = "هنوز به‌روزرسانی خودکار اجرا نشده";
    return;
  }

  const date = new Date(updatedAt);
  const ageHours = (Date.now() - date.getTime()) / 36e5;
  const formatted = date.toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (ageHours > 12) {
    dot.classList.add("stale");
    text.textContent = `آخرین به‌روزرسانی: ${formatted} (قدیمی)`;
  } else {
    dot.classList.remove("stale");
    text.textContent = `آخرین به‌روزرسانی: ${formatted}`;
  }
}

// ==========================================
// اجرای اصلی
// ==========================================
let currentPrices = null;

function update(prices) {
  const liveTotal = renderLive(prices);
  const manualTotal = renderManual();
  const grand = liveTotal + manualTotal;
  document.getElementById("grand-total").innerHTML = `${fa(grand)} <small>هزار تومان</small>`;
}

function refreshAll() {
  if (currentPrices) update(currentPrices);
}

async function init() {
  // آدرس ریپازیتوری گیت‌هاب (اگه خواستید لینک فوتر رو درست کنید)
  const repoLink = document.getElementById("repo-link");
  repoLink.href = window.location.href.includes("github.io")
    ? `https://github.com/${window.location.hostname.split(".")[0]}/${window.location.pathname.split("/")[1]}`
    : "#";

  try {
    const res = await fetch("data/prices.json", { cache: "no-store" });
    const prices = await res.json();
    currentPrices = prices;

    renderFreshness(prices.updated_at);
    update(prices);

    const statusNote = document.getElementById("status-note");
    const coinsStatus = prices.status?.coins || "نامشخص";
    const fundsStatus = prices.status?.funds || "نامشخص";
    statusNote.textContent = `وضعیت طلا/سکه: ${coinsStatus} — وضعیت صندوق‌ها: ${fundsStatus}`;
  } catch (e) {
    document.getElementById("status-note").textContent =
      "خطا در خواندن data/prices.json — مطمئن شوید Action حداقل یک‌بار اجرا شده.";
    currentPrices = { coins: {}, funds: {} };
    renderFreshness(null);
    update(currentPrices);
  }
}

init();
