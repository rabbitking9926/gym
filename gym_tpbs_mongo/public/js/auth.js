"use strict";
/* Đăng ký và đăng nhập: gửi lên máy chủ, hiển thị lỗi từng ô do máy chủ trả về */

function viewRegister(errors = {}, v = {}) {
  $("#app").innerHTML = '<form class="card" id="f" novalidate>' + flashHtml() + "<h1>Đăng ký</h1>" +
    '<label>Họ tên<input name="ho_ten" maxlength="100" value="' + esc(v.ho_ten) + '"></label>' + fieldErr(errors, "ho_ten") +
    '<label>Email<input name="email" type="email" maxlength="150" value="' + esc(v.email) + '"></label>' + fieldErr(errors, "email") +
    '<label>Số điện thoại (tùy chọn)<input name="so_dien_thoai" value="' + esc(v.so_dien_thoai) + '"></label>' + fieldErr(errors, "so_dien_thoai") +
    '<label>Mật khẩu<input name="mat_khau" type="password" autocomplete="new-password"></label>' + fieldErr(errors, "mat_khau") +
    '<label>Xác nhận mật khẩu<input name="xac_nhan" type="password" autocomplete="new-password"></label>' + fieldErr(errors, "xac_nhan") +
    '<button class="btn" type="submit">Đăng ký</button></form>';
  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    const r = await call("POST", "/register", d);
    if (!r.ok) return r.data.errors ? viewRegister(r.data.errors, d) : notify("error", r.data.error || "Có lỗi xảy ra.");
    flash = { t: "success", m: "Đăng ký thành công. Hãy đăng nhập." };
    go("login"); render();
  };
}

function viewLogin(email = "") {
  $("#app").innerHTML = '<form class="card" id="f">' + flashHtml() + "<h1>Đăng nhập</h1>" +
    '<label>Email<input name="email" type="email" value="' + esc(email) + '"></label>' +
    '<label>Mật khẩu<input name="mat_khau" type="password" autocomplete="current-password"></label>' +
    '<button class="btn" type="submit">Đăng nhập</button></form>';
  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    const r = await call("POST", "/login", d);
    if (!r.ok) { flash = { t: "error", m: r.data.error || "Đăng nhập thất bại." }; return viewLogin(d.email); }
    await refresh(); go(r.data.vai_tro === "Admin" ? "admin" : "profile"); render();
  };
}
