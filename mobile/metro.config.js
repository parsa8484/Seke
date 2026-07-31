const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// این سیستم رم کمی داره (~۴ گیگ). Metro به‌طور پیش‌فرض به تعداد هسته‌های CPU
// پردازش موازی (worker) باز می‌کنه که هرکدوم صدها مگابایت رم مصرف می‌کنن و
// باعث کرش "JavaScript heap out of memory" می‌شه. محدودش می‌کنیم به ۱.
config.maxWorkers = 1;

module.exports = config;
