const express = require("express");
const { Health, Plan, Sub, Product, Order, Checkin, ExpLog, Badge, User, getConfig } = require("../models");
const { requireLogin, wrap, validId } = require("../middleware");
const L = require("../logic");

const router = express.Router();
router.use(requireLogin);

/* ---- Hồ sơ + BMI ---- */
router.put("/profile", wrap(async (req, res) => {
  const b = req.body || {}, u = req.user, errors = {};
  const ho_ten = L.str(b.ho_ten), phone = L.str(b.so_dien_thoai);
  if (!ho_ten) errors.ho_ten = "Vui lòng nhập họ tên."; else if (ho_ten.length > 100) errors.ho_ten = "Họ tên tối đa 100 ký tự.";
  if (phone && !L.PHONE_RE.test(phone)) errors.so_dien_thoai = "Số điện thoại không hợp lệ (VD: 0912345678).";
  const h = L.parseMeasure(b.chieu_cao, "Chiều cao", L.HEIGHT, "cm"), w = L.parseMeasure(b.can_nang, "Cân nặng", L.WEIGHT, "kg");
  if (h.err) errors.chieu_cao = h.err;
  if (w.err) errors.can_nang = w.err;
  if (!h.err && !w.err && (h.v == null) !== (w.v == null)) errors[h.v == null ? "chieu_cao" : "can_nang"] = "Vui lòng nhập đủ cả chiều cao và cân nặng.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Dữ liệu chưa hợp lệ.", errors });
  const changed = h.v !== u.chieu_cao || w.v !== u.can_nang;
  Object.assign(u, { ho_ten, so_dien_thoai: phone || null, chieu_cao: h.v, can_nang: w.v, chi_so_bmi: L.calcBmi(h.v, w.v) });
  await u.save();
  if (changed && u.chi_so_bmi != null) await Health.create({ user: u._id, chieu_cao: h.v, can_nang: w.v, chi_so_bmi: u.chi_so_bmi });
  res.json({ ok: true });
}));

/* ---- Gói tập ---- */
router.post("/plans/subscribe", wrap(async (req, res) => {
  const { id, use } = req.body || {}, u = req.user;
  if (!validId(id)) return res.status(400).json({ error: "Gói tập không hợp lệ." });
  const p = await Plan.findById(id);
  if (!p || !p.active) return res.status(400).json({ error: "Gói này không còn được bán." });
  const t = L.today();
  await Sub.updateMany({ user: u._id, status: "Active", end: { $lt: t } }, { status: "Expired" });
  const badges = await Badge.find();
  const pct = use ? L.discountOf(badges, u.exp) : 0, badge = L.badgeFor(badges, u.exp);
  if (use && !pct) return res.status(400).json({ error: "Huy hiệu hiện tại chưa có ưu đãi giảm giá." });
  const gia = L.discounted(p.gia, pct);       // giá và % giảm được chốt tại thời điểm mua
  try {
    await Sub.create({ user: u._id, plan: p._id, ten: p.ten, start: t, end: L.addDays(t, p.thoi_han), gia, gia_goc: p.gia, giam: pct, badge: pct ? badge.ten : null });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: "Bạn đang có gói còn hạn, chưa thể đăng ký thêm." });
    throw e;
  }
  if (pct) {   // dùng huy hiệu: EXP về 0, bắt đầu lại (chuỗi điểm danh được giữ nguyên)
    await ExpLog.create({ user: u._id, exp: -u.exp, reason: `Dùng huy hiệu ${badge.ten} giảm ${pct}% gói ${p.ten}, EXP về 0` });
    await User.updateOne({ _id: u._id }, { exp: 0 });
  }
  res.json({ ok: true, gia, giam: pct, ten: p.ten });
}));

/* ---- Giỏ hàng ---- */
const qtyOf = (v) => (/^\d+$/.test(L.str(v)) ? Number(L.str(v)) : NaN);
router.post("/cart/add", wrap(async (req, res) => {
  const { id } = req.body || {}, q = qtyOf((req.body || {}).qty), u = req.user;
  const p = validId(id) ? await Product.findById(id) : null;
  if (!p || !p.active) return res.status(400).json({ error: "Sản phẩm không còn kinh doanh." });
  if (!Number.isInteger(q) || q < 1) return res.status(400).json({ error: "Số lượng phải là số nguyên từ 1 trở lên." });
  const it = u.cart.find((c) => String(c.pid) === id), tot = (it ? it.qty : 0) + q;
  if (tot > p.ton) return res.status(400).json({ error: `Chỉ còn ${p.ton} sản phẩm ${p.ten}.` });
  if (it) it.qty = tot; else u.cart.push({ pid: p._id, qty: q });
  await u.save(); res.json({ ok: true, ten: p.ten });
}));
router.post("/cart/set", wrap(async (req, res) => {
  const { pid } = req.body || {}, q = qtyOf((req.body || {}).qty), u = req.user;
  if (!validId(pid) || !Number.isInteger(q)) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  if (q === 0) u.cart = u.cart.filter((c) => String(c.pid) !== pid);
  else {
    const p = await Product.findById(pid), it = u.cart.find((c) => String(c.pid) === pid);
    if (!p || !it) return res.status(400).json({ error: "Sản phẩm không có trong giỏ." });
    if (q > p.ton) return res.status(400).json({ error: `Chỉ còn ${p.ton} sản phẩm ${p.ten}.` });
    it.qty = q;
  }
  await u.save(); res.json({ ok: true });
}));

/* ---- Đặt hàng: giá và tồn kho luôn tính ở server, trừ kho nguyên tử để không bán quá số lượng ---- */
router.post("/checkout", wrap(async (req, res) => {
  const b = req.body || {}, u = req.user, addr = L.str(b.addr), phone = L.str(b.phone), pay = L.str(b.pay);
  if (!u.cart.length) return res.status(400).json({ error: "Giỏ hàng trống." });
  if (!addr || addr.length > 255) return res.status(400).json({ error: "Vui lòng nhập địa chỉ nhận hàng." });
  if (!L.PHONE_RE.test(phone)) return res.status(400).json({ error: "Số điện thoại nhận hàng không hợp lệ." });
  if (!["cod", "card-ok", "card-fail"].includes(pay)) return res.status(400).json({ error: "Phương thức thanh toán không hợp lệ." });
  const taken = [], rollback = () => Promise.all(taken.map((i) => Product.updateOne({ _id: i.pid }, { $inc: { ton: i.qty } })));
  for (const c of u.cart) {
    const p = await Product.findOneAndUpdate({ _id: c.pid, active: true, ton: { $gte: c.qty } }, { $inc: { ton: -c.qty } });   // p = bản ghi trước khi trừ
    if (!p) {
      await rollback();
      const cur = await Product.findById(c.pid);
      return res.status(409).json({ error: !cur || !cur.active ? "Có sản phẩm không còn kinh doanh, vui lòng xóa khỏi giỏ." : `Không đủ tồn kho cho ${cur.ten} (còn ${cur.ton}).` });
    }
    taken.push({ pid: p._id, ten: p.ten, qty: c.qty, gia: p.gia });
  }
  const total = taken.reduce((s, i) => s + i.gia * i.qty, 0);
  let order;
  try {
    order = await Order.create({ user: u._id, total, status: pay === "card-ok" ? "Paid" : "Pending", addr, phone, pay, items: taken });
  } catch (e) { await rollback(); throw e; }
  u.cart = []; await u.save();
  res.status(201).json({ ok: true, id: String(order._id), status: order.status, pay });
}));

router.post("/orders/:id/cancel", wrap(async (req, res) => {
  const id = req.params.id;
  const o = validId(id) ? await Order.findOneAndUpdate({ _id: id, user: req.user._id, status: "Pending" }, { status: "Cancelled" }) : null;
  if (!o) return res.status(400).json({ error: "Không thể hủy đơn này." });
  await Promise.all(o.items.map((i) => Product.updateOne({ _id: i.pid }, { $inc: { ton: i.qty } })));
  res.json({ ok: true });
}));

/* ---- Điểm danh ---- */
router.post("/checkin", wrap(async (req, res) => {
  const u = req.user, d = L.today(), cfg = await getConfig();
  try { await Checkin.create({ user: u._id, date: d }); }          // unique(user,date): chặn điểm danh 2 lần/ngày kể cả khi gửi đồng thời
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: "Hôm nay bạn đã điểm danh rồi, không cộng thưởng lần nữa." }); throw e; }
  const streak = u.last === L.addDays(d, -1) ? u.streak + 1 : 1;   // bỏ lỡ ngày thì chuỗi đặt lại về 1
  const exp = L.expOnDay(cfg, streak), badges = await Badge.find(), before = L.badgeFor(badges, u.exp);
  const nu = await User.findByIdAndUpdate(u._id, { $inc: { exp }, $set: { streak, last: d } }, { new: true });
  await Checkin.updateOne({ user: u._id, date: d }, { exp });
  await ExpLog.create({ user: u._id, exp, reason: `Điểm danh ngày ${d} (chuỗi ${streak})` });
  const after = L.badgeFor(badges, nu.exp);
  res.json({ ok: true, exp, streak, badgeUp: after && (!before || String(before._id) !== String(after._id)) ? after.ten : null });
}));

module.exports = router;
