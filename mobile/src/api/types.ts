export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginEvent {
  id: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface HoldingItem {
  assetKey: string;
  category: "coin" | "gold" | "fund" | "currency" | "crypto" | "manual" | string;
  label: string;
  unit: string;
  quantity: number;
  /** میانگین قیمت خرید هر واحد به تومان — null یعنی کاربر ثبت نکرده */
  avgBuyPrice: number | null;
  price: number | null;
  priceUpdatedAt: string | null;
  value: number;
  /** avgBuyPrice × quantity — فقط وقتی قیمت خرید ثبت شده باشد */
  cost: number | null;
  profit: number | null;
  profitPercent: number | null;
}

export interface HoldingsSummary {
  items: HoldingItem[];
  total: number;
  /** جمع بهای خرید — فقط دارایی‌هایی که قیمت خرید دارند */
  totalCost: number | null;
  totalProfit: number | null;
  totalProfitPercent: number | null;
}

export interface HoldingInput {
  assetKey: string;
  quantity: number;
  avgBuyPrice?: number | null;
}

// ----------------------------- بازار (tgju) -----------------------------

export type MarketUnit = "toman" | "usd" | "point";

export interface MarketItem {
  symbol: string;
  label: string;
  category: string;
  unit: MarketUnit;
  price: number;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  /** "high" | "low" | "" طبق خود tgju */
  direction: string;
  updatedAt: string | null;
}

export interface MarketResponse {
  items: MarketItem[];
  categories: { key: string; label: string }[];
  fetchedAgoMs: number | null;
}

export interface HistoryPoint {
  date: string;
  /** تاریخ شمسی آماده از tgju مثل "1405/05/08" — برای دارایی‌های دستی null */
  jdate: string | null;
  price: number;
}

export interface AssetHistory {
  assetKey: string;
  label: string;
  source: "tgju" | "local";
  points: HistoryPoint[];
}

export interface MarketHistory {
  symbol: string;
  label: string;
  unit: MarketUnit;
  points: { date: string; jdate: string; open: number; low: number; high: number; close: number }[];
}

// ----------------------------- هشدار قیمت -----------------------------

export type AlertDirection = "above" | "below";

export interface PriceAlert {
  id: string;
  assetKey: string;
  label: string;
  unit: string;
  currentPrice: number | null;
  direction: AlertDirection;
  targetPrice: number;
  isActive: boolean;
  triggeredAt: string | null;
  triggeredPrice: number | null;
  createdAt: string;
}

// ----------------------------- ادمین -----------------------------

export interface AdminStats {
  userCount: number;
  activeUserCount: number;
  holdingCount: number;
  totalHoldingsValue: number;
  assetsMissingPrice: { key: string; label: string }[];
  /** آیا منبع قیمت (tgju) در دسترس است */
  tgjuReachable: boolean;
  tgjuSymbolCount: number;
}

export interface TgjuSymbolOption {
  symbol: string;
  label: string;
  category: string;
  categoryLabel: string;
  unit: MarketUnit;
  price: number | null;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  holdingsCount: number;
}

export interface AdminUserHolding {
  assetKey: string;
  label: string;
  quantity: number;
  price: number | null;
  value: number;
}

export interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    role: Role;
    isActive: boolean;
    createdAt: string;
  };
  holdings: AdminUserHolding[];
  totalValue: number;
}

// brsapi حذف شد — اندپوینتش از کار افتاد و همه‌چیز از tgju می‌آید
export type AssetSourceType = "tgju" | "manual";

export interface AdminAsset {
  id: string;
  key: string;
  category: string;
  label: string;
  unit: string;
  sourceType: AssetSourceType;
  sourceRef: string | null;
  priceUnit: MarketUnit | null;
  isActive: boolean;
  sortOrder: number;
  currentPrice: number | null;
  priceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAssetInput {
  key: string;
  category: string;
  label: string;
  unit: string;
  sourceType: AssetSourceType;
  sourceRef?: string;
  priceUnit?: MarketUnit | null;
  sortOrder?: number;
}
