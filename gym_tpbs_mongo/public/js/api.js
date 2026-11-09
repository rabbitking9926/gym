"use strict";
/* Gọi API máy chủ (Express + MongoDB). Giao diện giữ một bản chụp dữ liệu `db` lấy từ GET /api/state. */

const fresh = () => ({ today: null, session: null, users: [], history: [], subs: [], orders: [], expLog: [], carts: {}, plans: [], products: [], badges: [], config: { expBase: 10, bonus: 2, cap: 10 } });
let db = fresh();

async function call(method, url, body) {
  try {
    const r = await fetch("/api" + url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = {}; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: "Không kết nối được máy chủ." } };
  }
}
async function refresh() { const r = await call("GET", "/state"); db = r.ok ? r.data : fresh(); }

/* Gọi API làm thay đổi dữ liệu: thành công -> tải lại dữ liệu -> báo thành công; lỗi -> báo lỗi (trả null) */
async function act(method, url, body, okMsg) {
  const r = await call(method, url, body);
  if (r.status === 401) { await refresh(); flash = { t: "error", m: r.data.error || "Phiên đăng nhập đã hết hạn." }; go("login"); return null; }
  if (!r.ok) { notify("error", r.data.error || "Có lỗi xảy ra."); return null; }
  await refresh();
  notify("success", typeof okMsg === "function" ? okMsg(r.data) : okMsg || "Đã lưu.");
  return r.data;
}
/* Như act nhưng không hiện thông báo thành công (dùng cho nút +/−, ẩn/hiện...) */
async function quiet(method, url, body) {
  const r = await call(method, url, body);
  if (!r.ok) return notify("error", r.data.error || "Có lỗi xảy ra.");
  await refresh(); render();
}
