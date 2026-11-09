"use strict";
/* Gói tập: danh sách, gợi ý theo BMI, đăng ký (có dùng huy hiệu giảm giá) và lịch sử */

const mySub = (u) => db.subs.find((s) => s.uid === u.id && s.status === "Active");
const planFit = (p, bmi) => bmi != null && (p.bmi_min == null || bmi >= p.bmi_min) && (p.bmi_max == null || bmi <= p.bmi_max);
const rangeTxt = (p) => p.bmi_min == null && p.bmi_max == null ? "Mọi mức BMI" : (p.bmi_min ?? 0) + " – " + (p.bmi_max ?? "∞");
const discounted = (gia, pct) => Math.round((gia * (100 - pct)) / 100);
const daysLeft = (end) => Math.ceil((new Date(end) - new Date(today())) / 864e5);

function viewPlans() {
  const u = currentUser(), bmi = u.chi_so_bmi, sub = mySub(u), dc = discountOf(u);
  const hint = bmi == null
    ? 'Cập nhật chiều cao/cân nặng ở <a href="#profile">Hồ sơ</a> để nhận gợi ý gói tập.'
    : "BMI của bạn là <b>" + bmi.toFixed(2) + "</b> (" + classify(bmi) + "). Gói phù hợp được đánh dấu; bạn vẫn tự chọn gói mong muốn. Gợi ý chỉ mang tính tham khảo.";
  const cards = db.plans.filter((p) => p.active).map((p) => {
    const fit = planFit(p, bmi);
    return '<div class="card pl' + (fit ? " fit" : "") + '"><h2>' + esc(p.ten) + (fit ? ' <span class="tag">Phù hợp BMI</span>' : "") + "</h2><p>" + esc(p.mo_ta) +
      "</p><div><b>" + money(p.gia) + "</b> · " + p.thoi_han + ' ngày</div><div class="mut">BMI gợi ý: ' + rangeTxt(p) + "</div>" +
      '<button class="btn" data-act="subscribe" data-id="' + p.id + '">Đăng ký gói</button>' +
      (dc ? '<button class="btn alt" data-act="subscribe" data-use="1" data-id="' + p.id + '">Dùng huy hiệu: ' + money(discounted(p.gia, dc)) + " (−" + dc + '%)</button><div class="mut">EXP sẽ về 0 sau khi dùng.</div>' : "") + "</div>";
  }).join("");
  const mine = db.subs.filter((s) => s.uid === u.id).reverse();
  $("#app").innerHTML = flashHtml() + '<div class="card wide"><h1>Gói tập</h1><p>' + hint + "</p>" +
    (dc ? '<p class="msg success">Huy hiệu <b>' + esc(badgeFor(u.exp).ten) + "</b> cho bạn giảm tới <b>" + dc + "%</b> gói tập. Dùng huy hiệu sẽ đưa EXP về 0 và bắt đầu lại.</p>" : "") +
    (sub ? '<div class="msg success">Gói đang dùng: <b>' + esc(sub.ten) + "</b>, hết hạn " + sub.end + " (còn " + daysLeft(sub.end) + " ngày).</div>" : "") +
    '</div><div class="cards">' + (cards || '<p class="mut">Chưa có gói tập nào đang bán.</p>') + "</div>" +
    (mine.length ? '<div class="card wide"><h1>Lịch sử đăng ký</h1><div class="scroll"><table><tr><th>Gói</th><th>Bắt đầu</th><th>Hết hạn</th><th>Giá đã chốt</th><th>Trạng thái</th></tr>' +
      mine.map((s) => "<tr><td>" + esc(s.ten) + "</td><td>" + s.start + "</td><td>" + s.end + "</td><td>" + money(s.gia) + (s.giam ? " (−" + s.giam + "% huy hiệu " + esc(s.badge) + ")" : "") + "</td><td>" + s.status + "</td></tr>").join("") + "</table></div></div>" : "");
}

/* Máy chủ kiểm tra gói còn bán, gói đang dùng, quyền dùng huy hiệu và tính giá */
ACT.subscribe = ({ id, use }) => act("POST", "/plans/subscribe", { id, use: use === "1" }, (r) =>
  "Đăng ký " + r.ten + " thành công với giá " + money(r.gia) + "." + (r.giam ? " Đã giảm " + r.giam + "%, EXP về 0 và bạn bắt đầu lại từ đầu." : ""));
