"use strict";
/* Phân loại BMI để hiển thị (việc tính và kiểm tra BMI do máy chủ thực hiện) */

function classify(b) {
  if (b == null) return "";
  return b < 18.5 ? "Thiếu cân" : b < 25 ? "Bình thường" : b < 30 ? "Thừa cân" : "Béo phì";
}
