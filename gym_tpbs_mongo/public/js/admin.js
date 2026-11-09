"use strict";
/* Trang quản trị: hội viên, gói tập, sản phẩm, đơn hàng, phần thưởng. Mọi thay đổi gọi API /api/admin (máy chủ kiểm tra quyền). */

const ADMIN_TABS = [["admin", "Hội viên"], ["admin-plans", "Gói tập"], ["admin-products", "Sản phẩm"], ["admin-orders", "Đơn hàng"], ["admin-rewards", "Phần thưởng"]];
function adminPage(cur, html) {
  $("#app").innerHTML = '<div class="tabs">' + ADMIN_TABS.map(([h, t]) => '<a href="#' + h + '"' + (h === cur ? ' class="on"' : "") + ">" + t + "</a>").join("") + "</div>" + flashHtml() + html;
}
function viewForbidden() {
  $("#app").innerHTML = '<div class="card"><h1>403 – Không đủ quyền</h1><p>Chức năng này chỉ dành cho Admin.</p></div>';
}

function viewAdmin() {
  const rows = db.users.map((u, i) => { const s = mySub(u), b = badgeFor(u.exp);
    return "<tr><td>" + (i + 1) + "</td><td>" + esc(u.ho_ten) + "</td><td>" + esc(u.email) + "</td><td>" + esc(u.so_dien_thoai || "–") + "</td><td>" + u.vai_tro + "</td><td>" +
      (u.chi_so_bmi != null ? u.chi_so_bmi.toFixed(2) : "–") + "</td><td>" + (s ? esc(s.ten) + " (đến " + s.end + ")" : "–") + "</td><td>" + u.exp + (b ? " · " + esc(b.ten) : "") + "</td></tr>"; }).join("");
  adminPage("admin", '<div class="card wide"><h1>Danh sách hội viên</h1><div class="scroll"><table><tr><th>STT</th><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Vai trò</th><th>BMI</th><th>Gói tập</th><th>EXP</th></tr>' + rows + "</table></div></div>");
}

/* ---- CRUD dùng chung cho gói tập, sản phẩm, huy hiệu (kiểm tra dữ liệu do máy chủ làm) ---- */
const CRUD = {
  plans: { title: "Quản lý gói tập", active: true,
    cols: [["ten", "Tên"], ["gia", "Giá", (r) => money(r.gia)], ["thoi_han", "Ngày"], ["bmi", "BMI gợi ý", rangeTxt]],
    fields: [["ten", "Tên gói"], ["mo_ta", "Mô tả"], ["gia", "Giá (đ)", "number"], ["thoi_han", "Thời hạn (ngày)", "number"], ["bmi_min", "BMI tối thiểu", "number"], ["bmi_max", "BMI tối đa", "number"]] },
  products: { title: "Quản lý sản phẩm", active: true,
    cols: [["ten", "Tên"], ["gia", "Giá", (r) => money(r.gia)], ["ton", "Tồn kho"]],
    fields: [["ten", "Tên sản phẩm"], ["mo_ta", "Mô tả"], ["gia", "Giá bán (đ)", "number"], ["ton", "Tồn kho", "number"]] },
  badges: { title: "Huy hiệu và mốc EXP", active: false,
    cols: [["ten", "Huy hiệu"], ["moc", "EXP yêu cầu"], ["giam", "Giảm giá gói", (r) => (r.giam || 0) + "%"],
      ["ngay", "Điểm danh liên tục để đạt", (r) => { const d = daysToReach(r.moc); return d == null ? "Không đạt" : d + " ngày" + (d > 30 ? " (quá 1 tháng)" : ""); }]],
    fields: [["ten", "Tên huy hiệu"], ["moc", "EXP tối thiểu", "number"], ["giam", "Giảm giá gói tập (%, tối đa 30)", "number"]] },
};
const editing = {};
const fld = (n, l, v, t) => '<label>' + l + '<input name="' + n + '" type="' + (t || "text") + '"' + (t === "number" ? ' step="any"' : "") + ' value="' + esc(v ?? "") + '"></label>';

function crudHtml(kind) {
  const c = CRUD[kind], e = editing[kind], rec = e === "new" ? {} : (db[kind].find((x) => x.id === e) || {});
  const form = e ? '<form class="card wide" data-form="crud" novalidate><input type="hidden" name="kind" value="' + kind + '"><input type="hidden" name="id" value="' + (rec.id || "") + '"><h2>' +
    (rec.id ? "Sửa" : "Thêm mới") + '</h2><div class="row">' + c.fields.map(([k, l, t]) => fld(k, l, rec[k], t)).join("") + '</div><button class="btn" type="submit">Lưu</button></form>' : "";
  const rows = db[kind].map((r) => "<tr>" + c.cols.map(([k, , f]) => "<td>" + esc(f ? f(r) : r[k]) + "</td>").join("") + (c.active ? "<td>" + (r.active ? "Đang bán" : "Đã ẩn") + "</td>" : "") +
    '<td><button class="sm" data-act="crud-edit" data-kind="' + kind + '" data-id="' + r.id + '">Sửa</button> <button class="sm" data-act="crud-' + (c.active ? "toggle" : "del") + '" data-kind="' + kind + '" data-id="' + r.id + '">' +
    (c.active ? (r.active ? "Ẩn" : "Hiện") : "Xóa") + "</button></td></tr>").join("");
  return form + '<div class="card wide"><h1>' + c.title + ' <button class="sm" data-act="crud-edit" data-kind="' + kind + '" data-id="new">+ Thêm</button></h1><div class="scroll"><table><tr>' +
    c.cols.map(([, l]) => "<th>" + l + "</th>").join("") + (c.active ? "<th>Trạng thái</th>" : "") + "<th></th></tr>" + rows + "</table></div></div>";
}
ACT["crud-edit"] = ({ kind, id }) => { editing[kind] = id; render(); };
ACT["crud-toggle"] = ({ kind, id }) => quiet("POST", "/admin/" + kind + "/" + id + "/toggle");
ACT["crud-del"] = ({ kind, id }) => quiet("DELETE", "/admin/" + kind + "/" + id);
FORM.crud = async (d) => {
  const body = { ...d }; delete body.kind; delete body.id;
  const r = await act(d.id ? "PUT" : "POST", "/admin/" + d.kind + (d.id ? "/" + d.id : ""), body, "Đã lưu.");
  if (r) { editing[d.kind] = null; render(); }
};

/* ---- Đơn hàng ---- */
const STATUSES = ["Pending", "Paid", "Shipping", "Done", "Cancelled"];
function viewAdminOrders() {
  const rows = db.orders.slice().reverse().map((o) => { const u = db.users.find((x) => x.id === o.uid);
    return "<tr><td>#" + o.id.slice(-6) + "</td><td>" + esc(u ? u.email : "?") + "</td><td>" + fmtDate(o.t) + "</td><td>" + o.items.map((i) => esc(i.ten) + "×" + i.qty).join(", ") + "</td><td>" + money(o.total) +
      "</td><td>" + PAY[o.pay] + '</td><td><select data-change="order-status" data-id="' + o.id + '">' + STATUSES.map((s) => "<option" + (s === o.status ? " selected" : "") + ">" + s + "</option>").join("") + "</select></td></tr>"; }).join("");
  adminPage("admin-orders", '<div class="card wide"><h1>Quản lý đơn hàng</h1>' + (rows ? '<div class="scroll"><table><tr><th>Mã</th><th>Khách</th><th>Thời gian</th><th>Sản phẩm</th><th>Tổng</th><th>Thanh toán</th><th>Trạng thái</th></tr>' + rows + "</table></div>" : '<p class="mut">Chưa có đơn hàng.</p>') + "</div>");
}
CHG["order-status"] = ({ id }, val) => act("PUT", "/admin/orders/" + id + "/status", { status: val }, "Đã cập nhật trạng thái đơn thành " + val + ".");

/* ---- Phần thưởng ---- */
function previewTxt() {
  const m = maxExp(30), b = badgeFor(m);
  return "Điểm danh đủ 30 ngày liên tục: tối đa " + m + " EXP" + (b ? ", đạt huy hiệu " + b.ten + " (giảm " + Math.min(MAX_DISCOUNT, b.giam || 0) + "% gói tập)" : "") +
    ". EXP ngày thứ n = cơ bản + thưởng thêm × min(n − 1, số ngày tối đa).";
}
function viewRewards() {
  const c = db.config, log = db.expLog.slice().reverse().slice(0, 10);
  adminPage("admin-rewards", '<form class="card wide" data-form="config" novalidate><h1>Cấu hình EXP điểm danh</h1><div class="row">' +
    fld("expBase", "EXP cơ bản mỗi lần", c.expBase, "number") + fld("bonus", "Thưởng thêm mỗi ngày trong chuỗi", c.bonus, "number") + fld("cap", "Số ngày chuỗi tối đa được thưởng thêm", c.cap, "number") +
    '</div><button class="btn" type="submit">Lưu cấu hình</button><p class="mut">' + previewTxt() + "</p></form>" + crudHtml("badges") +
    (log.length ? '<div class="card wide"><h1>Lịch sử thưởng gần đây</h1><div class="scroll"><table><tr><th>Thời gian</th><th>Hội viên</th><th>EXP</th><th>Lý do</th></tr>' +
      log.map((l) => { const u = db.users.find((x) => x.id === l.uid); return "<tr><td>" + fmtDate(l.t) + "</td><td>" + esc(u ? u.email : "?") + "</td><td>" + (l.exp > 0 ? "+" : "") + l.exp + "</td><td>" + esc(l.reason) + "</td></tr>"; }).join("") + "</table></div></div>" : ""));
}
FORM.config = (d) => act("PUT", "/admin/config", d, "Đã lưu cấu hình thưởng.");
