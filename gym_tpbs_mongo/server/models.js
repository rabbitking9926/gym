const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const User = model("User", new Schema({
  ho_ten: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 150 },
  mat_khau: { type: String, required: true },               // chuỗi băm bcrypt
  so_dien_thoai: { type: String, default: null },
  vai_tro: { type: String, enum: ["Admin", "Member"], default: "Member" },
  chieu_cao: { type: Number, default: null },
  can_nang: { type: Number, default: null },
  chi_so_bmi: { type: Number, default: null },
  exp: { type: Number, default: 0, min: 0 },
  streak: { type: Number, default: 0 },
  last: { type: String, default: null },                    // ngày điểm danh gần nhất YYYY-MM-DD
  cart: [{ _id: false, pid: { type: ObjectId, ref: "Product" }, qty: { type: Number, min: 1 } }],
}, { timestamps: true }));

const Health = model("Health", new Schema({                 // lịch sử chiều cao/cân nặng/BMI
  user: { type: ObjectId, ref: "User", required: true, index: true },
  chieu_cao: Number, can_nang: Number, chi_so_bmi: Number,
  t: { type: Date, default: Date.now },
}));

const Plan = model("Plan", new Schema({
  ten: { type: String, required: true }, mo_ta: { type: String, default: "" },
  gia: { type: Number, required: true, min: 0 }, thoi_han: { type: Number, required: true, min: 1 },
  bmi_min: { type: Number, default: null }, bmi_max: { type: Number, default: null },
  active: { type: Boolean, default: true },
}));

const subSchema = new Schema({
  user: { type: ObjectId, ref: "User", required: true },
  plan: { type: ObjectId, ref: "Plan", required: true },
  ten: String, start: String, end: String,                  // ngày dạng YYYY-MM-DD
  gia: Number, gia_goc: Number, giam: { type: Number, default: 0 }, badge: { type: String, default: null },
  status: { type: String, enum: ["Active", "Expired", "Cancelled"], default: "Active" },
});
// Mỗi hội viên chỉ có tối đa một gói Active (chặn đăng ký trùng khi 2 request đến cùng lúc)
subSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: "Active" } });
const Sub = model("Sub", subSchema);

const Product = model("Product", new Schema({
  ten: { type: String, required: true }, mo_ta: { type: String, default: "" },
  gia: { type: Number, required: true, min: 0 }, ton: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
}));

const Order = model("Order", new Schema({
  user: { type: ObjectId, ref: "User", required: true, index: true },
  total: Number, t: { type: Date, default: Date.now },
  status: { type: String, enum: ["Pending", "Paid", "Shipping", "Done", "Cancelled"], default: "Pending" },
  addr: String, phone: String, pay: { type: String, enum: ["cod", "card-ok", "card-fail"] },
  items: [{ _id: false, pid: ObjectId, ten: String, qty: Number, gia: Number }],   // đơn giá chốt lúc mua
}));

const checkinSchema = new Schema({ user: { type: ObjectId, required: true }, date: { type: String, required: true }, exp: { type: Number, default: 0 } });
checkinSchema.index({ user: 1, date: 1 }, { unique: true });  // mỗi ngày điểm danh một lần
const Checkin = model("Checkin", checkinSchema);

const ExpLog = model("ExpLog", new Schema({
  user: { type: ObjectId, required: true, index: true }, exp: Number, reason: String, t: { type: Date, default: Date.now },
}));

const Badge = model("Badge", new Schema({
  ten: { type: String, required: true, unique: true }, moc: { type: Number, required: true, min: 0 },
  giam: { type: Number, default: 0, min: 0, max: 30 },
}));

const Config = model("Config", new Schema({
  key: { type: String, default: "main", unique: true },
  expBase: { type: Number, default: 10 }, bonus: { type: Number, default: 2 }, cap: { type: Number, default: 10 },
  seeded: { type: Boolean, default: false },
}));
const getConfig = async () => (await Config.findOne({ key: "main" })) || Config.create({ key: "main" });

module.exports = { User, Health, Plan, Sub, Product, Order, Checkin, ExpLog, Badge, Config, getConfig };
