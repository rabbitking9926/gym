const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { JWT_SECRET, COOKIE_SECURE } = require("../config");
const { wrap } = require("../middleware");
const { EMAIL_RE, PHONE_RE, str } = require("../logic");

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);   // chống dò email qua thời gian phản hồi

/* Giới hạn đăng nhập sai: 10 lần / 15 phút cho mỗi IP + email (bộ nhớ tiến trình) */
const fails = new Map();
const keyOf = (req, email) => req.ip + "|" + email;
const tooMany = (k) => { const f = fails.get(k); return f && f.n >= 10 && Date.now() - f.t < 15 * 60e3; };
const noteFail = (k) => { const f = fails.get(k); fails.set(k, f && Date.now() - f.t < 15 * 60e3 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }); };

router.post("/register", wrap(async (req, res) => {
  const b = req.body || {}, errors = {};
  const ho_ten = str(b.ho_ten), email = str(b.email).toLowerCase(), phone = str(b.so_dien_thoai);
  const pw = typeof b.mat_khau === "string" ? b.mat_khau : "";
  if (!ho_ten) errors.ho_ten = "Vui lòng nhập họ tên."; else if (ho_ten.length > 100) errors.ho_ten = "Họ tên tối đa 100 ký tự.";
  if (!email) errors.email = "Vui lòng nhập email."; else if (email.length > 150 || !EMAIL_RE.test(email)) errors.email = "Email không hợp lệ.";
  if (phone && !PHONE_RE.test(phone)) errors.so_dien_thoai = "Số điện thoại không hợp lệ (VD: 0912345678).";
  if (pw.length < 8) errors.mat_khau = "Mật khẩu tối thiểu 8 ký tự.";
  else if (Buffer.byteLength(pw) > 72) errors.mat_khau = "Mật khẩu tối đa 72 byte.";
  else if (pw !== b.xac_nhan) errors.xac_nhan = "Mật khẩu xác nhận không khớp.";
  if (!errors.email && (await User.exists({ email }))) errors.email = "Email này đã được đăng ký.";
  if (Object.keys(errors).length) return res.status(400).json({ error: "Dữ liệu chưa hợp lệ.", errors });
  try {
    // vai_tro luôn là Member, không bao giờ nhận từ client
    await User.create({ ho_ten, email, so_dien_thoai: phone || null, mat_khau: await bcrypt.hash(pw, 10), vai_tro: "Member" });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: "Dữ liệu chưa hợp lệ.", errors: { email: "Email này đã được đăng ký." } });
    throw e;
  }
  res.status(201).json({ ok: true });
}));

router.post("/login", wrap(async (req, res) => {
  const email = str((req.body || {}).email).toLowerCase();
  const pw = typeof (req.body || {}).mat_khau === "string" ? req.body.mat_khau : "";
  const k = keyOf(req, email);
  if (tooMany(k)) return res.status(429).json({ error: "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút." });
  const user = email ? await User.findOne({ email }) : null;
  const ok = await bcrypt.compare(pw.slice(0, 72), user ? user.mat_khau : DUMMY_HASH);
  if (!user || !ok) { noteFail(k); return res.status(401).json({ error: "Email hoặc mật khẩu không đúng." }); }
  fails.delete(k);
  const token = jwt.sign({ id: String(user._id) }, JWT_SECRET, { expiresIn: "7d" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, maxAge: 7 * 864e5 });
  res.json({ ok: true, vai_tro: user.vai_tro });
}));

router.post("/logout", (req, res) => { res.clearCookie("token"); res.json({ ok: true }); });

module.exports = router;
