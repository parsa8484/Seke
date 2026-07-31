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
  category: "coin" | "fund" | "manual" | string;
  label: string;
  unit: string;
  quantity: number;
  price: number | null;
  priceUpdatedAt: string | null;
  value: number;
}

export interface HoldingsSummary {
  items: HoldingItem[];
  total: number;
}

// ----------------------------- ادمین -----------------------------

export interface AdminStats {
  userCount: number;
  activeUserCount: number;
  holdingCount: number;
  totalHoldingsValue: number;
  assetsMissingPrice: { key: string; label: string }[];
  brsapiConfigured: boolean;
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

export type AssetSourceType = "tgju" | "brsapi" | "manual";

export interface AdminAsset {
  id: string;
  key: string;
  category: string;
  label: string;
  unit: string;
  sourceType: AssetSourceType;
  sourceRef: string | null;
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
  sortOrder?: number;
}
