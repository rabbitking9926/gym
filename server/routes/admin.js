const express = require("express");
const { Plan, Product, Badge, Order, Config, getConfig } = require("../models");
const { requireAdmin, wrap, validId } = require("../middleware");
const L = require("../logic");

const router = express.Router();
router.use(requireAdmin);

const KINDS = { plans: { Model: Plan, validate: L.validatePlan, active: true }, products: { Model: Product, validate: L.validateProduct, active: true }, badges: { Model: Badge, validate: L.validateBadge, active: false } };
const kindOf = (req, res, next) => { const k = KINDS[req.params.kind]; if (!k) return res.status(404).json({ error: "Không tìm thấy." }); req.kind = k; next(); };


router.put("/config", wrap(async (req, res) => {
  const b = req.body || {}, keys = ["expBase", "bonus", "cap"];
  const v = keys.map((k) => Number(L.str(b[k])));
  if (keys.some((k) => L.str(b[k]) === "") || v.some((x) => !Number.isInteger(x) || x < 0)) return res.status(400).json({ error: "Các giá trị phải là số nguyên không âm." });
  await getConfig(); await Config.updateOne({ key: "main" }, { expBase: v[0], bonus: v[1], cap: v[2] });
  res.json({ ok: true });
}));

router.put("/orders/:id/status", wrap(async (req, res) => {
  const status = L.str((req.body || {}).status), id = req.params.id;
  if (!validId(id) || !["Pending", "Paid", "Shipping", "Done", "Cancelled"].includes(status)) return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  const o = await Order.findOneAndUpdate({ _id: id, status: { $ne: "Cancelled" } }, { status });   // đơn đã hủy không mở lại được
  if (!o) return res.status(400).json({ error: "Đơn đã hủy không thể mở lại." });
  if (status === "Cancelled") await Promise.all(o.items.map((i) => Product.updateOne({ _id: i.pid }, { $inc: { ton: i.qty } })));
  res.json({ ok: true, id });
}));

router.post("/:kind", kindOf, wrap(async (req, res) => {
  const r = req.kind.validate(req.body || {});
  if (r.err) return res.status(400).json({ error: r.err });
  if (req.params.kind === "badges" && (await Badge.exists({ ten: r.obj.ten }))) return res.status(400).json({ error: "Tên huy hiệu đã tồn tại." });
  await req.kind.Model.create(req.kind.active ? { ...r.obj, active: true } : r.obj);
  res.status(201).json({ ok: true });
}));

router.put("/:kind/:id", kindOf, wrap(async (req, res) => {
  const r = req.kind.validate(req.body || {}), id = req.params.id;
  if (r.err) return res.status(400).json({ error: r.err });
  if (!validId(id)) return res.status(400).json({ error: "Mã không hợp lệ." });
  if (req.params.kind === "badges" && (await Badge.exists({ ten: r.obj.ten, _id: { $ne: id } }))) return res.status(400).json({ error: "Tên huy hiệu đã tồn tại." });
  const doc = await req.kind.Model.findByIdAndUpdate(id, r.obj);
  if (!doc) return res.status(404).json({ error: "Không tìm thấy." });
  res.json({ ok: true });
}));

router.post("/:kind/:id/toggle", kindOf, wrap(async (req, res) => {
  const id = req.params.id;
  if (!req.kind.active || !validId(id)) return res.status(400).json({ error: "Không hỗ trợ." });
  const doc = await req.kind.Model.findById(id);
  if (!doc) return res.status(404).json({ error: "Không tìm thấy." });
  doc.active = !doc.active; await doc.save(); res.json({ ok: true });
}));

router.delete("/:kind/:id", kindOf, wrap(async (req, res) => {
  const id = req.params.id;
  if (req.kind.active || !validId(id)) return res.status(400).json({ error: "Không hỗ trợ." });   // chỉ huy hiệu được xóa; gói/sản phẩm chỉ ẩn để giữ lịch sử
  await req.kind.Model.findByIdAndDelete(id); res.json({ ok: true });
}));

module.exports = router;
