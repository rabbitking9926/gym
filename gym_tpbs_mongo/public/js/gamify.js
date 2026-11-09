"use strict";
/* Điểm danh, chuỗi, EXP, huy hiệu. Hàm tính ở đây chỉ để hiển thị; máy chủ mới là nơi cộng EXP thật. */

const MAX_DISCOUNT = 30;
const badgeFor = (exp) => db.badges.filter((b) => b.moc <= exp).sort((a, b) => b.moc - a.moc)[0] || null;
const discountOf = (u) => { const b = badgeFor(u.exp); return b ? Math.min(MAX_DISCOUNT, b.giam || 0) : 0; };
/* EXP của ngày điểm danh thứ n trong chuỗi = cơ bản + thưởng thêm × min(n − 1, số ngày tối đa) */
const expOnDay = (n) => db.config.expBase + db.config.bonus * Math.min(n - 1, db.config.cap);
const maxExp = (days) => { let s = 0; for (let n = 1; n <= days; n++) s += expOnDay(n); return s; };
const daysToReach = (moc) => { if (moc <= 0) return 0; let s = 0; for (let n = 1; n <= 1000; n++) { s += expOnDay(n); if (s >= moc) return n; } return null; };
const streakNow = (u) => (u.last === today() || u.last === addDays(today(), -1)) ? u.streak : 0;

ACT.checkin = () => act("POST", "/checkin", undefined, (r) =>
  "Điểm danh thành công: +" + r.exp + " EXP, chuỗi " + r.streak + " ngày." + (r.badgeUp ? " Bạn đạt huy hiệu " + r.badgeUp + "!" : ""));

function viewCheckin() {
  const u = currentUser(), done = u.last === today(), b = badgeFor(u.exp);
  const next = db.badges.filter((x) => x.moc > u.exp).sort((a, c) => a.moc - c.moc)[0];
  const base = b ? b.moc : 0, pct = next ? Math.round(((u.exp - base) / (next.moc - base)) * 100) : 100;
  const log = db.expLog.filter((l) => l.uid === u.id).slice(-10).reverse();
  $("#app").innerHTML = flashHtml() + '<div class="card wide"><h1>Điểm danh và thành tích</h1><div class="stats">' +
    '<div class="stat"><b>' + u.exp + '</b><span>EXP</span></div><div class="stat"><b>' + streakNow(u) + '</b><span>Chuỗi (ngày)</span></div>' +
    '<div class="stat"><b>' + (b ? esc(b.ten) : "–") + "</b><span>Huy hiệu</span></div></div>" +
    '<div class="bar"><i style="width:' + pct + '%"></i></div><div class="mut">' + (next ? "Còn " + (next.moc - u.exp) + " EXP để đạt " + esc(next.ten) : "Bạn đã đạt huy hiệu cao nhất.") + "</div>" +
    "<p>" + (discountOf(u) ? "Huy hiệu hiện tại giảm <b>" + discountOf(u) + "%</b> khi đăng ký gói tập (tối đa 30%). Dùng huy hiệu thì EXP về 0 và bắt đầu lại." : "Đạt huy hiệu cao hơn để được giảm giá gói tập (tối đa 30%).") + "</p>" +
    '<button class="btn" data-act="checkin"' + (done ? " disabled" : "") + ">" + (done ? "Hôm nay đã điểm danh" : "Điểm danh hôm nay") + "</button></div>" +
    (log.length ? '<div class="card wide"><h1>Lịch sử thưởng</h1><div class="scroll"><table><tr><th>Thời gian</th><th>EXP</th><th>Lý do</th></tr>' +
      log.map((l) => "<tr><td>" + fmtDate(l.t) + "</td><td>" + (l.exp > 0 ? "+" : "") + l.exp + "</td><td>" + esc(l.reason) + "</td></tr>").join("") + "</table></div></div>" : "");
}
