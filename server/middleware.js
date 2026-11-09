const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");
const { User } = require("./models");

/* Đọc cookie đăng nhập; vai trò luôn lấy lại từ database nên đổi quyền có hiệu lực ngay */
async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies.token;
  if (token) {
    try { req.user = await User.findById(jwt.verify(token, JWT_SECRET).id); } catch (e) { /* token sai/hết hạn */ }
  }
  next();
}
const requireLogin = (req, res, next) => req.user ? next() : res.status(401).json({ error: "Vui lòng đăng nhập để tiếp tục." });
const requireAdmin = (req, res, next) => !req.user ? res.status(401).json({ error: "Vui lòng đăng nhập để tiếp tục." })
  : req.user.vai_tro !== "Admin" ? res.status(403).json({ error: "Không đủ quyền: chỉ dành cho Admin." }) : next();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

module.exports = { loadUser, requireLogin, requireAdmin, wrap, validId };
