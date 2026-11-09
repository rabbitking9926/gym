const express = require("express");
const { User, Health, Plan, Sub, Product, Order, ExpLog, Badge, getConfig } = require("../models");
const S = require("../serialize");
const { wrap } = require("../middleware");
const { today } = require("../logic");

const router = express.Router();

/* Ảnh chụp dữ liệu giao diện cần: Admin thấy tất cả, hội viên chỉ thấy dữ liệu của mình */
router.get("/state", wrap(async (req, res) => {
  const t = today();
  await Sub.updateMany({ status: "Active", end: { $lt: t } }, { status: "Expired" });   // gói quá hạn -> Expired
  const out = { today: t, session: null, users: [], history: [], subs: [], orders: [], expLog: [], carts: {}, plans: [], products: [], badges: [], config: {} };
  const u = req.user;
  if (!u) return res.json(out);
  const [plans, products, badges, cfg] = await Promise.all([Plan.find().sort("_id"), Product.find().sort("_id"), Badge.find().sort("moc"), getConfig()]);
  out.session = String(u._id);
  out.products = products.map(S.product);
  out.badges = badges.map(S.badge);
  out.config = { expBase: cfg.expBase, bonus: cfg.bonus, cap: cfg.cap };
  if (u.vai_tro === "Admin") {
    const [users, subs, orders, logs] = await Promise.all([User.find().sort("_id"), Sub.find().sort("_id"), Order.find().sort("_id"), ExpLog.find().sort({ t: -1 }).limit(50)]);
    Object.assign(out, { users: users.map(S.user), subs: subs.map(S.sub), orders: orders.map(S.order), expLog: logs.reverse().map(S.expLog), plans: plans.map(S.plan) });
  } else {
    const [subs, orders, logs, hist] = await Promise.all([Sub.find({ user: u._id }).sort("_id"), Order.find({ user: u._id }).sort("_id"),
      ExpLog.find({ user: u._id }).sort({ t: -1 }).limit(50), Health.find({ user: u._id }).sort("t")]);
    Object.assign(out, { users: [S.user(u)], subs: subs.map(S.sub), orders: orders.map(S.order), expLog: logs.reverse().map(S.expLog),
      history: hist.map(S.health), plans: plans.filter((p) => p.active).map(S.plan) });
    out.carts[String(u._id)] = S.cart(u);
  }
  res.json(out);
}));

module.exports = router;
