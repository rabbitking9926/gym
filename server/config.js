require("dotenv").config();

const cfg = {
  PORT: Number(process.env.PORT) || 3000,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gym_tpbs",
  JWT_SECRET: process.env.JWT_SECRET || "dev-only-change-me",
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || "admin@gym.vn").toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "MatKhau123",
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
};
if (process.env.NODE_ENV === "production" && cfg.JWT_SECRET === "dev-only-change-me") {
  throw new Error("Hãy đặt JWT_SECRET trong môi trường production.");
}
module.exports = cfg;
