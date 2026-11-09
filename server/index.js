const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { PORT, MONGODB_URI } = require("./config");
const { loadUser } = require("./middleware");
const { seed } = require("./seed");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" });
    next();
  });
  app.use(express.json({ limit: "50kb" }));
  app.use(cookieParser());
  app.use("/api/admin", loadUser, require("./routes/admin"));
  app.use("/api", loadUser, require("./routes/state"), require("./routes/auth"), require("./routes/member"));
  app.use("/api", (req, res) => res.status(404).json({ error: "Không tìm thấy." }));
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use((err, req, res, next) => {   // eslint-disable-line no-unused-vars
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Dữ liệu gửi lên không hợp lệ." });
    console.error(err);
    res.status(500).json({ error: "Lỗi máy chủ, vui lòng thử lại." });
  });
  return app;
}

async function start() {
  await mongoose.connect(MONGODB_URI);
  await seed();
  createApp().listen(PORT, () => console.log(`Gym & TPBS chạy tại http://localhost:${PORT}`));
}
if (require.main === module) start().catch((e) => { console.error("Không khởi động được:", e.message); process.exit(1); });

module.exports = { createApp };
