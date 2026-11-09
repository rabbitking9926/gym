/* Kiểm thử API với MongoDB thật. Chạy: MONGODB_URI=mongodb://127.0.0.1:27017/gym_tpbs_test npm test */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gym_tpbs_test_" + Date.now();
const M = require("../server/models");
const L = require("../server/logic");
let server, base;

function client() {
  let cookie = "";
  return async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const t = (r.headers.getSetCookie() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith("token="));
    if (t) cookie = t === "token=" ? "" : t;
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { status: r.status, data };
  };
}
const reg = (c, email = "a@x.com", extra = {}) => c("POST", "/api/register", { ho_ten: "Nguyễn A", email, mat_khau: "matkhau123", xac_nhan: "matkhau123", ...extra });
const login = (c, email = "a@x.com", mat_khau = "matkhau123") => c("POST", "/api/login", { email, mat_khau });

before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(M).filter((x) => x.syncIndexes).map((x) => x.syncIndexes()));
  await require("../server/seed").seed();
  server = require("../server").createApp().listen(0);
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); server.close(); });

test("đăng ký: băm mật khẩu, luôn là Member, chặn email trùng và dữ liệu sai", async () => {
  const c = client();
  assert.equal((await reg(c, "a@x.com", { vai_tro: "Admin" })).status, 201);
  const u = await M.User.findOne({ email: "a@x.com" });
  assert.equal(u.vai_tro, "Member");
  assert.notEqual(u.mat_khau, "matkhau123");
  const dup = await reg(c, "A@X.com");
  assert.equal(dup.status, 400); assert.match(dup.data.errors.email, /đã được đăng ký/);
  assert.equal((await reg(c, "b@x.com", { mat_khau: "123", xac_nhan: "123" })).status, 400);
  assert.equal((await reg(c, "khong-phai-email")).status, 400);
  assert.equal((await reg(c, "c@x.com", { so_dien_thoai: "abc" })).status, 400);
  assert.equal(await M.User.countDocuments({ email: { $in: ["b@x.com", "c@x.com"] } }), 0);
});

test("đăng nhập: sai mật khẩu, NoSQL injection, đúng mật khẩu", async () => {
  const c = client();
  assert.equal((await login(c, "a@x.com", "sai-mat-khau")).status, 401);
  assert.equal((await c("POST", "/api/login", { email: { $ne: "" }, mat_khau: "matkhau123" })).status, 401);
  assert.equal((await c("GET", "/api/state")).data.session, null);
  assert.equal((await login(c)).status, 200);
  assert.ok((await c("GET", "/api/state")).data.session);
});

test("phân quyền: chưa đăng nhập 401, Member 403, Admin vào được; Member chỉ thấy dữ liệu của mình", async () => {
  const anon = client(), mem = client(), adm = client();
  assert.equal((await anon("GET", "/api/admin/plans")).status, 401);
  assert.equal((await anon("POST", "/api/admin/plans", {})).status, 401);
  await login(mem);
  assert.equal((await mem("POST", "/api/admin/plans", { ten: "x" })).status, 403);
  assert.equal((await mem("PUT", "/api/admin/config", { expBase: 1, bonus: 1, cap: 1 })).status, 403);
  const st = (await mem("GET", "/api/state")).data;
  assert.equal(st.users.length, 1); assert.equal(st.users[0].email, "a@x.com"); assert.equal(st.users[0].mat_khau, undefined);
  await login(adm, "admin@gym.vn", "MatKhau123");
  assert.ok((await adm("GET", "/api/state")).data.users.length >= 2);
});

test("hồ sơ + BMI + lịch sử", async () => {
  const c = client(); await login(c);
  const ok = await c("PUT", "/api/profile", { ho_ten: "A", so_dien_thoai: "0912345678", chieu_cao: "175", can_nang: "70" });
  assert.equal(ok.status, 200);
  let st = (await c("GET", "/api/state")).data;
  assert.equal(st.users[0].chi_so_bmi, 22.86); assert.equal(st.history.length, 1);
  await c("PUT", "/api/profile", { ho_ten: "A", chieu_cao: "175", can_nang: "70" });
  assert.equal((await c("GET", "/api/state")).data.history.length, 1);
  for (const bad of [{ chieu_cao: "50", can_nang: "70" }, { chieu_cao: "abc", can_nang: "70" }, { chieu_cao: "175", can_nang: "" }, { chieu_cao: "175", can_nang: "-3" }])
    assert.equal((await c("PUT", "/api/profile", { ho_ten: "A", ...bad })).status, 400);
  assert.equal((await c("GET", "/api/state")).data.users[0].chi_so_bmi, 22.86);
});

test("gói tập: đăng ký, giá chốt, chặn trùng, gói ẩn, hết hạn", async () => {
  const c = client(), adm = client(); await login(c); await login(adm, "admin@gym.vn", "MatKhau123");
  const plans = (await c("GET", "/api/state")).data.plans;
  const duytri = plans.find((p) => p.ten === "Gói Duy trì");
  const r = await c("POST", "/api/plans/subscribe", { id: duytri.id });
  assert.equal(r.status, 200); assert.equal(r.data.gia, 600000);
  assert.equal((await c("POST", "/api/plans/subscribe", { id: duytri.id })).status, 400);        // đang có gói
  await M.Sub.updateOne({ user: (await M.User.findOne({ email: "a@x.com" }))._id }, { end: "2000-01-01" });
  assert.equal((await c("GET", "/api/state")).data.subs[0].status, "Expired");
  const tc = plans.find((p) => p.ten === "Gói Tăng cơ");
  await adm("POST", `/api/admin/plans/${tc.id}/toggle`);
  const hid = await c("POST", "/api/plans/subscribe", { id: tc.id });
  assert.equal(hid.status, 400); assert.match(hid.data.error, /không còn được bán/);
  assert.equal((await c("POST", "/api/plans/subscribe", { id: "khong-phai-objectid" })).status, 400);
});

test("giỏ hàng, tồn kho, thanh toán, giữ đơn giá, hủy đơn hoàn kho", async () => {
  const c = client(), adm = client(); await login(c); await login(adm, "admin@gym.vn", "MatKhau123");
  const whey = (await c("GET", "/api/state")).data.products.find((p) => p.ten.startsWith("Whey"));
  assert.equal((await c("POST", "/api/cart/add", { id: whey.id, qty: "3" })).status, 200);
  assert.equal((await c("POST", "/api/cart/add", { id: whey.id, qty: "99" })).status, 400);
  assert.equal((await c("POST", "/api/checkout", { addr: "1 Lê Lợi", phone: "abc", pay: "cod" })).status, 400);
  const o = await c("POST", "/api/checkout", { addr: "1 Lê Lợi", phone: "0912345678", pay: "card-fail" });
  assert.equal(o.status, 201); assert.equal(o.data.status, "Pending");
  assert.equal((await M.Product.findById(whey.id)).ton, 17);
  await M.Product.updateOne({ _id: whey.id }, { gia: 1 });                                       // đổi giá sau khi mua
  let st = (await c("GET", "/api/state")).data;
  assert.equal(st.orders[0].items[0].gia, 850000); assert.equal(st.orders[0].total, 2550000);
  assert.equal(st.carts[st.session].length, 0);
  assert.equal((await c("POST", `/api/orders/${o.data.id}/cancel`)).status, 200);
  assert.equal((await M.Product.findById(whey.id)).ton, 20);
  assert.equal((await c("POST", `/api/orders/${o.data.id}/cancel`)).status, 400);                // hủy lần 2
  await c("POST", "/api/cart/add", { id: whey.id, qty: "1" });
  assert.equal((await c("POST", "/api/checkout", { addr: "x", phone: "0912345678", pay: "card-ok" })).data.status, "Paid");
  const id = (await M.Order.findOne({ status: "Paid" }))._id;
  assert.equal((await adm("PUT", `/api/admin/orders/${id}/status`, { status: "Shipping" })).status, 200);
  assert.equal((await adm("PUT", `/api/admin/orders/${id}/status`, { status: "Cancelled" })).status, 200);
  assert.equal((await M.Product.findById(whey.id)).ton, 20);                                     // admin hủy cũng hoàn kho
  assert.equal((await adm("PUT", `/api/admin/orders/${id}/status`, { status: "Paid" })).status, 400);
});

test("đồng thời: 2 người cùng mua sản phẩm chỉ còn 1 -> chỉ 1 đơn thành công", async () => {
  const a = client(), b = client(); await reg(a, "p1@x.com"); await reg(b, "p2@x.com"); await login(a, "p1@x.com"); await login(b, "p2@x.com");
  const p = await M.Product.create({ ten: "Hàng hiếm", gia: 1000, ton: 1 });
  await a("POST", "/api/cart/add", { id: String(p._id), qty: "1" }); await b("POST", "/api/cart/add", { id: String(p._id), qty: "1" });
  const body = { addr: "x", phone: "0912345678", pay: "cod" };
  const rs = await Promise.all([a("POST", "/api/checkout", body), b("POST", "/api/checkout", body)]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await M.Product.findById(p._id)).ton, 0);
});

test("điểm danh: 1 lần/ngày (kể cả gửi đồng thời), chuỗi tăng/reset, lên huy hiệu", async () => {
  const c = client(); await login(c);
  const uid = (await M.User.findOne({ email: "a@x.com" }))._id, d = L.today();
  const rs = await Promise.all([c("POST", "/api/checkin"), c("POST", "/api/checkin"), c("POST", "/api/checkin")]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
  let u = await M.User.findById(uid); assert.equal(u.exp, 10); assert.equal(u.streak, 1);
  await M.Checkin.deleteMany({ user: uid }); await M.User.updateOne({ _id: uid }, { last: L.addDays(d, -1), streak: 3, exp: 0 });
  assert.equal((await c("POST", "/api/checkin")).data.exp, 16);                                  // 10 + 2*3
  await M.Checkin.deleteMany({ user: uid }); await M.User.updateOne({ _id: uid }, { last: L.addDays(d, -3) });
  const r = await c("POST", "/api/checkin"); assert.equal(r.data.streak, 1);                     // bỏ lỡ ngày -> reset
  await M.Checkin.deleteMany({ user: uid }); await M.User.updateOne({ _id: uid }, { exp: 95, last: null });
  assert.equal((await c("POST", "/api/checkin")).data.badgeUp, "Bạc");
});

test("dùng huy hiệu: giảm tối đa 30%, EXP về 0, Đồng không dùng được", async () => {
  const c = client(), adm = client(); await login(c); await login(adm, "admin@gym.vn", "MatKhau123");
  const uid = (await M.User.findOne({ email: "a@x.com" }))._id;
  await M.Sub.deleteMany({ user: uid }); await M.User.updateOne({ _id: uid }, { exp: 0, streak: 5 });
  const duytri = (await c("GET", "/api/state")).data.plans.find((p) => p.ten === "Gói Duy trì");
  assert.equal((await c("POST", "/api/plans/subscribe", { id: duytri.id, use: true })).status, 400);   // Đồng 0%
  await M.User.updateOne({ _id: uid }, { exp: 300 });
  const r = await c("POST", "/api/plans/subscribe", { id: duytri.id, use: true });
  assert.equal(r.data.gia, 420000); assert.equal(r.data.giam, 30);
  const u = await M.User.findById(uid); assert.equal(u.exp, 0); assert.equal(u.streak, 5);
  const sub = await M.Sub.findOne({ user: uid, status: "Active" }); assert.equal(sub.gia_goc, 600000);
  assert.equal((await M.ExpLog.findOne({ user: uid }).sort({ _id: -1 })).exp, -300);
  assert.equal((await adm("POST", "/api/admin/badges", { ten: "Quá tay", moc: "2000", giam: "50" })).status, 400);   // không cho >30%
});

test("admin: kiểm tra dữ liệu gói/sản phẩm/huy hiệu/cấu hình", async () => {
  const adm = client(); await login(adm, "admin@gym.vn", "MatKhau123");
  assert.equal((await adm("POST", "/api/admin/plans", { ten: "G", mo_ta: "", gia: "1", thoi_han: "7", bmi_min: "30", bmi_max: "20" })).status, 400);
  assert.equal((await adm("POST", "/api/admin/products", { ten: "S", gia: "5000", ton: "-1" })).status, 400);
  assert.equal((await adm("POST", "/api/admin/products", { ten: "SP mới", gia: "5000", ton: "4" })).status, 201);
  assert.equal((await adm("POST", "/api/admin/badges", { ten: "Kim cương", moc: "1000", giam: "30" })).status, 201);
  assert.equal((await adm("POST", "/api/admin/badges", { ten: "Kim cương", moc: "1", giam: "1" })).status, 400);    // trùng tên
  assert.equal((await adm("PUT", "/api/admin/config", { expBase: "", bonus: 2, cap: 10 })).status, 400);
  assert.equal((await adm("PUT", "/api/admin/config", { expBase: 10, bonus: 2, cap: 10 })).status, 200);
  const kc = (await M.Badge.findOne({ ten: "Kim cương" }))._id;
  assert.equal((await adm("DELETE", `/api/admin/badges/${kc}`)).status, 200);
  assert.equal((await adm("DELETE", `/api/admin/plans/${(await M.Plan.findOne())._id}`)).status, 400);              // gói chỉ ẩn, không xóa
});
