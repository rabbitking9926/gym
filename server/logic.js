/* Luật nghiệp vụ dùng chung: ngày giờ, BMI, EXP, huy hiệu, kiểm tra dữ liệu */
const MAX_DISCOUNT = 30;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^(\+84|0)\d{9,10}$/;
const HEIGHT = [100, 250], WEIGHT = [20, 300];

const today = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);   // giờ Việt Nam (UTC+7)
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const str = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");   // chặn object (NoSQL injection)

function parseMeasure(raw, label, [lo, hi], unit) {
  const s = str(raw).replace(",", ".");
  if (!s) return { v: null };
  if (!/^\d+(\.\d+)?$/.test(s)) return { err: label + " phải là một số dương." };
  const v = Math.round(Number(s) * 100) / 100;
  if (v < lo || v > hi) return { err: `${label} phải nằm trong khoảng ${lo} – ${hi} ${unit}.` };
  return { v };
}
const calcBmi = (h, w) => (h && w ? Math.round((w / Math.pow(h / 100, 2)) * 100) / 100 : null);

const expOnDay = (cfg, n) => cfg.expBase + cfg.bonus * Math.min(n - 1, cfg.cap);
const badgeFor = (badges, exp) => badges.filter((b) => b.moc <= exp).sort((a, b) => b.moc - a.moc)[0] || null;
const discountOf = (badges, exp) => { const b = badgeFor(badges, exp); return b ? Math.min(MAX_DISCOUNT, b.giam || 0) : 0; };
const discounted = (gia, pct) => Math.round((gia * (100 - pct)) / 100);

function validatePlan(d) {
  const gia = Number(d.gia), th = Number(d.thoi_han);
  const opt = (v) => (str(v) === "" ? null : Number(str(v)));
  const a = opt(d.bmi_min), b = opt(d.bmi_max);
  if (!str(d.ten)) return { err: "Vui lòng nhập tên gói." };
  if (str(d.gia) === "" || !(gia >= 0)) return { err: "Giá không hợp lệ." };
  if (!Number.isInteger(th) || th <= 0) return { err: "Thời hạn phải là số nguyên dương." };
  if ((a != null && !(a >= 0)) || (b != null && !(b >= 0)) || (a != null && b != null && a > b)) return { err: "Khoảng BMI không hợp lệ." };
  return { obj: { ten: str(d.ten), mo_ta: str(d.mo_ta), gia, thoi_han: th, bmi_min: a, bmi_max: b } };
}
function validateProduct(d) {
  const gia = Number(d.gia), ton = Number(d.ton);
  if (!str(d.ten)) return { err: "Vui lòng nhập tên sản phẩm." };
  if (str(d.gia) === "" || !(gia >= 0)) return { err: "Giá bán không hợp lệ." };
  if (str(d.ton) === "" || !Number.isInteger(ton) || ton < 0) return { err: "Tồn kho phải là số nguyên không âm." };
  return { obj: { ten: str(d.ten), mo_ta: str(d.mo_ta), gia, ton } };
}
function validateBadge(d) {
  const moc = Number(d.moc), giam = Number(d.giam);
  if (!str(d.ten)) return { err: "Vui lòng nhập tên huy hiệu." };
  if (str(d.moc) === "" || !Number.isInteger(moc) || moc < 0) return { err: "Mốc EXP phải là số nguyên không âm." };
  if (str(d.giam) === "" || !Number.isInteger(giam) || giam < 0 || giam > MAX_DISCOUNT) return { err: "Giảm giá phải là số nguyên từ 0 đến 30%." };
  return { obj: { ten: str(d.ten), moc, giam } };
}

module.exports = { MAX_DISCOUNT, EMAIL_RE, PHONE_RE, HEIGHT, WEIGHT, today, addDays, str, parseMeasure, calcBmi, expOnDay, badgeFor, discountOf, discounted, validatePlan, validateProduct, validateBadge };
