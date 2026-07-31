-- CreateTable: تاریخچه‌ی ورود کاربران
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "login_events_userId_createdAt_idx" ON "login_events"("userId", "createdAt");
