import test from "node:test";
import assert from "node:assert/strict";
import {
  mapCompanyInfo,
  mapSummary,
  mapTableRows,
} from "../../src/server/layout/extractionMap.mjs";

test("mapCompanyInfo aligns label-style keys to template field keys", () => {
  const fields = [
    { key: "companyName", label: "公司名称" },
    { key: "address", label: "地址" },
  ];
  const raw = {
    公司名称: "惠州市罗丰实业有限公司",
    地址: "广东省惠州市惠阳区...",
  };
  const mapped = mapCompanyInfo(raw, fields);
  assert.equal(mapped.companyName, "惠州市罗丰实业有限公司");
  assert.equal(mapped.address, "广东省惠州市惠阳区...");
});

test("mapSummary aligns canonical keys to Chinese summary labels", () => {
  const mapped = mapSummary(
    { totalAmount: "1000.00", tax: "130.00" },
    ["总金额", "税额"]
  );
  assert.equal(mapped["总金额"], "1000.00");
  assert.equal(mapped["税额"], "130.00");
});

test("mapTableRows maps english keys to Chinese headers", () => {
  const headers = ["序号", "产品名称", "数量", "单价", "总额"];
  const rows = [
    { no: "1", productName: "客制_拉松轮", qty: "2", price: "15", amount: "30" },
  ];
  const mapped = mapTableRows(rows, headers);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]["序号"], "1");
  assert.equal(mapped[0]["产品名称"], "客制_拉松轮");
  assert.equal(mapped[0]["数量"], "2");
  assert.equal(mapped[0]["单价"], "15");
  assert.equal(mapped[0]["总额"], "30");
});
