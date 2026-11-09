"use strict";
/* Thành phần giao diện chung: thanh điều hướng, thông báo, trang chủ */

let flash = null;
const currentUser = () => db.users.find((u) => u.id === db.session) || null;
const go = (h) => { location.hash = h; };
const fieldErr = (e, k) => e[k] ? '<div class="err">' + esc(e[k]) + "</div>" : "";
const notify = (t, m) => { flash = { t, m }; render(); };
const MEMBER_NAV = [["profile", "Hồ sơ"], ["plans", "Gói tập"], ["shop", "Cửa hàng"], ["cart", "Giỏ hàng"], ["orders", "Đơn hàng"], ["checkin", "Điểm danh"]];

function renderNav() {
  const u = currentUser();
  const cur = (location.hash || "#").slice(1);
  const a = (h, t) => '<a href="#' + h + '"' + (cur === h || (h === "admin" && cur.startsWith("admin")) ? ' class="on"' : "") + ">" + t + "</a>";
  const n = u ? (db.carts[u.id] || []).reduce((s, c) => s + c.qty, 0) : 0;
  $("#nav").innerHTML = '<a class="brand" href="#">Gym &amp; TPBS</a>' + (u
    ? (u.vai_tro === "Admin" ? a("admin", "Quản trị") : MEMBER_NAV.map(([h, t]) => a(h, h === "cart" && n ? t + " (" + n + ")" : t)).join("")) +
      '<button id="logout">Đăng xuất</button>'
    : a("login", "Đăng nhập") + a("register", "Đăng ký"));
  const lo = $("#logout");
  if (lo) lo.onclick = async () => { await call("POST", "/logout"); await refresh(); flash = { t: "success", m: "Đã đăng xuất." }; go("login"); render(); };
}

function flashHtml() {
  const f = flash; flash = null;
  return f ? '<div class="msg ' + f.t + '">' + esc(f.m) + "</div>" : "";
}

function viewHome() {
  $("#app").innerHTML = '<div class="card">' + flashHtml() + "<h1>Gym &amp; TPBS</h1>" +
    "<p>Quản lý hội viên, gói tập, cửa hàng thực phẩm bổ sung và điểm danh nhận thưởng.</p>" +
    '<p class="mut">Đăng ký tài khoản để bắt đầu.</p></div>';
}
