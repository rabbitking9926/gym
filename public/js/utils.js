"use strict";
/* Tiện ích: chọn phần tử, escape HTML, định dạng, bảng xử lý sự kiện dùng chung */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleString("vi-VN");

const ACT = {}, FORM = {}, CHG = {};          // xử lý click / submit / change (gắn ở app.js)
const money = (n) => Number(n).toLocaleString("vi-VN") + "đ";
const today = () => (typeof db !== "undefined" && db.today) || new Date().toLocaleDateString("sv-SE");   // ngày theo máy chủ
const addDays = (d, n) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv-SE"); };
