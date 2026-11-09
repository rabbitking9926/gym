"use strict";
/* Cửa hàng TPBS: sản phẩm, giỏ hàng, đặt hàng, thanh toán mô phỏng, lịch sử. Giá và tồn kho do máy chủ quyết định. */

let shopQ = "";
const PAY = { cod: "Khi nhận hàng", "card-ok": "Thẻ (mô phỏng)", "card-fail": "Thẻ (mô phỏng)" };
const findProduct = (id) => db.products.find((p) => p.id === id);
const cartOf = (u) => db.carts[u.id] || [];

function viewShop() {
  const list = db.products.filter((p) => p.active && p.ten.toLowerCase().includes(shopQ.toLowerCase()));
  $("#app").innerHTML = flashHtml() + '<form class="card wide inl" data-form="search"><input name="q" placeholder="Tìm sản phẩm…" value="' + esc(shopQ) + '"><button class="sm" type="submit">Tìm</button></form><div class="cards">' +
    (list.map((p) => '<form class="card pl" data-form="addcart"><input type="hidden" name="id" value="' + p.id + '"><h2>' + esc(p.ten) + "</h2><p>" + esc(p.mo_ta) +
      "</p><div><b>" + money(p.gia) + '</b> <span class="mut">' + (p.ton > 0 ? "Còn " + p.ton : "Hết hàng") + "</span></div>" +
      (p.ton > 0 ? '<div class="inl"><input name="qty" type="number" min="1" max="' + p.ton + '" value="1"><button class="sm" type="submit">Thêm vào giỏ</button></div>' : "") + "</form>").join("") ||
      '<p class="mut">Không có sản phẩm phù hợp.</p>') + "</div>";
}
FORM.search = (d) => { shopQ = d.q.trim(); render(); };
FORM.addcart = (d) => act("POST", "/cart/add", { id: d.id, qty: d.qty }, "Đã thêm vào giỏ hàng.");

function viewCart() {
  const u = currentUser(), cart = cartOf(u).filter((c) => findProduct(c.pid));
  const total = cart.reduce((s, c) => s + findProduct(c.pid).gia * c.qty, 0);
  if (!cart.length) { $("#app").innerHTML = flashHtml() + '<div class="card"><h1>Giỏ hàng</h1><p class="mut">Giỏ hàng đang trống. <a href="#shop">Đến cửa hàng</a></p></div>'; return; }
  $("#app").innerHTML = flashHtml() + '<div class="card wide"><h1>Giỏ hàng</h1><div class="scroll"><table><tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th></th></tr>' +
    cart.map((c) => { const p = findProduct(c.pid);
      return "<tr><td>" + esc(p.ten) + (p.active ? "" : ' <span class="tag">Ngừng bán</span>') + "</td><td>" + money(p.gia) + '</td><td><button class="sm" data-act="cart-dec" data-pid="' + p.id + '">−</button> ' + c.qty +
        ' <button class="sm" data-act="cart-inc" data-pid="' + p.id + '">+</button></td><td>' + money(p.gia * c.qty) + '</td><td><button class="sm" data-act="cart-del" data-pid="' + p.id + '">Xóa</button></td></tr>'; }).join("") +
    '</table></div><h2>Tổng: ' + money(total) + '</h2></div><form class="card" data-form="checkout" novalidate><h1>Thông tin nhận hàng</h1>' +
    '<label>Địa chỉ nhận<input name="addr" maxlength="255"></label><label>Số điện thoại nhận<input name="phone" value="' + esc(u.so_dien_thoai || "") + '"></label>' +
    '<label>Thanh toán<select name="pay"><option value="cod">Thanh toán khi nhận hàng</option><option value="card-ok">Thẻ (mô phỏng, thành công)</option><option value="card-fail">Thẻ (mô phỏng, thất bại)</option></select></label>' +
    '<button class="btn" type="submit">Đặt hàng</button><p class="mut">Máy chủ tính lại giá và kiểm tra tồn kho khi đặt hàng.</p></form>';
}
const cartLine = (pid) => cartOf(currentUser()).find((c) => c.pid === pid);
ACT["cart-inc"] = ({ pid }) => quiet("POST", "/cart/set", { pid, qty: cartLine(pid).qty + 1 });
ACT["cart-dec"] = ({ pid }) => quiet("POST", "/cart/set", { pid, qty: cartLine(pid).qty - 1 });   // về 0 thì máy chủ xóa dòng
ACT["cart-del"] = ({ pid }) => quiet("POST", "/cart/set", { pid, qty: 0 });

FORM.checkout = async (d) => {
  const r = await call("POST", "/checkout", d);
  if (!r.ok) return notify("error", r.data.error || "Đặt hàng thất bại.");
  await refresh();
  flash = r.data.pay === "card-fail" ? { t: "error", m: "Thanh toán thất bại, đơn ở trạng thái Pending (chưa Paid)." }
    : { t: "success", m: r.data.status === "Paid" ? "Thanh toán thành công, đơn đã Paid." : "Đặt hàng thành công, thanh toán khi nhận hàng." };
  go("orders"); render();
};

function viewOrders() {
  const u = currentUser(), list = db.orders.filter((o) => o.uid === u.id).reverse();
  $("#app").innerHTML = flashHtml() + "<h1>Lịch sử đơn hàng</h1>" + (list.map((o) =>
    '<div class="card wide"><div><b>Đơn #' + o.id.slice(-6) + '</b> <span class="tag">' + o.status + '</span> <span class="mut">' + fmtDate(o.t) + " · " + PAY[o.pay] + "</span></div><ul>" +
    o.items.map((i) => "<li>" + esc(i.ten) + " × " + i.qty + " @ " + money(i.gia) + "</li>").join("") + "</ul><div>Tổng: <b>" + money(o.total) + "</b> · Giao tới: " + esc(o.addr) + "</div>" +
    (o.status === "Pending" ? '<button class="sm" data-act="order-cancel" data-id="' + o.id + '">Hủy đơn</button>' : "") + "</div>").join("") || '<p class="mut">Bạn chưa có đơn hàng nào.</p>');
}
ACT["order-cancel"] = ({ id }) => act("POST", "/orders/" + id + "/cancel", undefined, "Đã hủy đơn và hoàn lại tồn kho.");
