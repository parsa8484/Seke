/** عدد را با جداکننده‌ی هزارگان و ارقام فارسی برمی‌گرداند (برای متن نوتیف و خطاها) */
export function formatTomanFa(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
