/* Dữ liệu khởi tạo: cấu hình, tài khoản Admin, gói tập, sản phẩm, huy hiệu (chỉ chạy một lần) */
const bcrypt = require("bcryptjs");
const { User, Plan, Product, Badge, Config, getConfig } = require("./models");
const { ADMIN_EMAIL, ADMIN_PASSWORD } = require("./config");

async function seed() {
  const cfg = await getConfig();
  if (!(await User.exists({ email: ADMIN_EMAIL }))) {
    await User.create({ ho_ten: "Quản trị viên", email: ADMIN_EMAIL, mat_khau: await bcrypt.hash(ADMIN_PASSWORD, 10), vai_tro: "Admin" });
  }
  // cờ seeded được đặt nguyên tử để chạy nhiều tiến trình cùng lúc cũng chỉ seed một lần
  const claim = await Config.updateOne({ key: "main", seeded: false }, { seeded: true });
  if (!claim.modifiedCount) return;
  await Plan.insertMany([
    { ten: "Gói Tăng cơ", mo_ta: "Giáo án tăng cơ, có huấn luyện viên hướng dẫn.", gia: 500000, thoi_han: 30, bmi_min: null, bmi_max: 18.49 },
    { ten: "Gói Duy trì", mo_ta: "Tập tự do toàn bộ phòng gym, khung giờ linh hoạt.", gia: 600000, thoi_han: 90, bmi_min: 18.5, bmi_max: 24.99 },
    { ten: "Gói Giảm cân", mo_ta: "Cardio kết hợp lớp nhóm và tư vấn dinh dưỡng.", gia: 450000, thoi_han: 30, bmi_min: 25, bmi_max: null },
    { ten: "Gói Tự do 6 tháng", mo_ta: "Dành cho mọi thể trạng, tập không giới hạn.", gia: 2400000, thoi_han: 180 },
  ]);
  await Product.insertMany([
    { ten: "Whey Protein 2kg", mo_ta: "Bổ sung đạm sau tập, vị chocolate.", gia: 850000, ton: 20 },
    { ten: "Creatine 300g", mo_ta: "Hỗ trợ sức mạnh và hiệu suất tập.", gia: 350000, ton: 15 },
    { ten: "BCAA 30 lần dùng", mo_ta: "Axit amin chuỗi nhánh, vị cam.", gia: 420000, ton: 10 },
    { ten: "Vitamin tổng hợp", mo_ta: "Bổ sung vi chất hằng ngày.", gia: 250000, ton: 30 },
  ]);
  await Badge.insertMany([{ ten: "Đồng", moc: 0, giam: 0 }, { ten: "Bạc", moc: 100, giam: 10 }, { ten: "Vàng", moc: 300, giam: 30 }]);
}
module.exports = { seed };
