-- AlterTable
ALTER TABLE "assets" ADD COLUMN "priceUnit" TEXT;

-- AlterTable
ALTER TABLE "holdings" ADD COLUMN "avgBuyPrice" REAL;

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'above',
    "targetPrice" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" DATETIME,
    "triggeredPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "price_alerts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "price_alerts_userId_idx" ON "price_alerts"("userId");

-- CreateIndex
CREATE INDEX "price_alerts_assetId_isActive_idx" ON "price_alerts"("assetId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");
