/* Chuyển document Mongoose thành JSON gọn cho giao diện (id là chuỗi, không lộ mật khẩu) */
const id = (x) => String(x);
module.exports = {
  user: (u) => ({ id: id(u._id), ho_ten: u.ho_ten, email: u.email, so_dien_thoai: u.so_dien_thoai, vai_tro: u.vai_tro,
    chieu_cao: u.chieu_cao, can_nang: u.can_nang, chi_so_bmi: u.chi_so_bmi, exp: u.exp, streak: u.streak, last: u.last }),
  plan: (p) => ({ id: id(p._id), ten: p.ten, mo_ta: p.mo_ta, gia: p.gia, thoi_han: p.thoi_han, bmi_min: p.bmi_min, bmi_max: p.bmi_max, active: p.active }),
  product: (p) => ({ id: id(p._id), ten: p.ten, mo_ta: p.mo_ta, gia: p.gia, ton: p.ton, active: p.active }),
  badge: (b) => ({ id: id(b._id), ten: b.ten, moc: b.moc, giam: b.giam }),
  sub: (s) => ({ id: id(s._id), uid: id(s.user), pid: id(s.plan), ten: s.ten, start: s.start, end: s.end, gia: s.gia, gia_goc: s.gia_goc, giam: s.giam, badge: s.badge, status: s.status }),
  order: (o) => ({ id: id(o._id), uid: id(o.user), total: o.total, t: o.t.toISOString(), status: o.status, addr: o.addr, phone: o.phone, pay: o.pay,
    items: o.items.map((i) => ({ pid: id(i.pid), ten: i.ten, qty: i.qty, gia: i.gia })) }),
  expLog: (l) => ({ uid: id(l.user), exp: l.exp, reason: l.reason, t: l.t.toISOString() }),
  health: (h) => ({ uid: id(h.user), h: h.chieu_cao, w: h.can_nang, bmi: h.chi_so_bmi, t: h.t.toISOString() }),
  cart: (u) => u.cart.map((c) => ({ pid: id(c.pid), qty: c.qty })),
};
