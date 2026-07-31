import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { authRouter } from "./routes/auth.routes";
import { holdingsRouter } from "./routes/holdings.routes";
import { pricesRouter } from "./routes/prices.routes";
import { marketRouter } from "./routes/market.routes";
import { alertsRouter } from "./routes/alerts.routes";
import { adminRouter } from "./routes/admin.routes";
import { startPriceRefreshLoop } from "./services/priceService";

const app = express();

app.use(
  cors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
  })
);
app.use(express.json());

// محدودیت نرخ درخواست روی مسیرهای احراز هویت برای جلوگیری از brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/holdings", holdingsRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/market", marketRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/admin", adminRouter);

app.use((_req, res) => res.status(404).json({ error: "مسیر پیدا نشد" }));

app.listen(config.port, () => {
  console.log(`✅ API روی http://localhost:${config.port} در حال اجراست`);
  startPriceRefreshLoop();
});
