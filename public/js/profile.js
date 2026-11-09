"use strict";
/* Trang hồ sơ hội viên: sửa thông tin, xem BMI và lịch sử chỉ số */

function viewProfile(errors = {}, form = null) {
  const u = currentUser();
  const f = form || { ho_ten: u.ho_ten, so_dien_thoai: u.so_dien_thoai || "", chieu_cao: u.chieu_cao ?? "", can_nang: u.can_nang ?? "" };
  const hist = db.history.filter((h) => h.uid === u.id).slice().reverse();
  const bmiBox = u.chi_so_bmi != null
    ? '<div class="bmi"><div>BMI: <b>' + u.chi_so_bmi.toFixed(2) + "</b> – " + classify(u.chi_so_bmi) +
      '</div><div class="mut">Chỉ mang tính tham khảo, không phải chẩn đoán y khoa.</div></div>' : "";
  $("#app").innerHTML = '<div class="grid"><form class="card" id="f" novalidate>' + flashHtml() + "<h1>Hồ sơ hội viên</h1>" +
    '<div class="mut">Email: ' + esc(u.email) + "</div>" +
    '<label>Họ tên<input name="ho_ten" maxlength="100" value="' + esc(f.ho_ten) + '"></label>' + fieldErr(errors, "ho_ten") +
    '<label>Số điện thoại<input name="so_dien_thoai" value="' + esc(f.so_dien_thoai) + '"></label>' + fieldErr(errors, "so_dien_thoai") +
    '<div class="row"><div><label>Chiều cao (cm)<input name="chieu_cao" inputmode="decimal" value="' + esc(f.chieu_cao) + '"></label>' + fieldErr(errors, "chieu_cao") +
    '</div><div><label>Cân nặng (kg)<input name="can_nang" inputmode="decimal" value="' + esc(f.can_nang) + '"></label>' + fieldErr(errors, "can_nang") + "</div></div>" +
    '<button class="btn" type="submit">Lưu hồ sơ</button>' + bmiBox + "</form>" +
    (hist.length ? '<div class="card wide"><h1>Lịch sử chỉ số</h1><div class="scroll"><table><tr><th>Thời gian</th><th>Cao (cm)</th><th>Nặng (kg)</th><th>BMI</th></tr>' +
      hist.map((h) => "<tr><td>" + fmtDate(h.t) + "</td><td>" + h.h + "</td><td>" + h.w + "</td><td>" + h.bmi.toFixed(2) + "</td></tr>").join("") +
      "</table></div></div>" : "") + "</div>";
  $("#f").onsubmit = async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    const r = await call("PUT", "/profile", d);
    if (!r.ok) return r.data.errors ? viewProfile(r.data.errors, d) : notify("error", r.data.error || "Có lỗi xảy ra.");
    await refresh(); notify("success", "Đã lưu hồ sơ.");
  };
}
