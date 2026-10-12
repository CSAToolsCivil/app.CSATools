/* CSA AI – kiểm tra nhanh dữ liệu nhập trong các file Excel CSA Tools (không đụng tới công thức/code) */
(function (root) {
  "use strict";
  function cellV(ws, addr) { var c = ws[addr]; return c ? (c.v === undefined ? "" : c.v) : ""; }
  function col(n) { var s = ""; n++; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  var RE = {
    rebar: /^\s*(\d+\s*[dDfFT]\s*\d+)?\s*(;\s*(\d+\s*[dDfFT]\s*\d+)?)?\s*$/,
    rebarMulti: /^\s*\d+\s*[dDfFT]\s*\d+(\s*[;,+]\s*\d*\s*[dDfFT]?\s*\d+)*\s*;?\s*$/,
    stir: /^\s*\d+\s*\/\s*\d+\s*\/\s*\d+\s*$/, sec: /^\s*\d+\s*(x\s*\d+)?(\s*\/\s*\d+\s*(x\s*\d+)?)*\s*$/i,
    giatTren: /^\s*-?\d+\s*(;\s*\d+\s*[dD]\s*\d+)?\s*$/, num: /^\s*-?\d+(\.\d+)?\s*$/, scale: /^\s*1\s*[:\/]\s*\d+\s*$/,
    tie: /^\s*[TtRrDd]?\s*\d+\s*[-a@]\s*\d+\s*$/
  };
  function check(wb) {
    var out = { sheets: wb.SheetNames.slice(), findings: [], summary: "" };
    function add(sev, sheet, addr, msg) { out.findings.push({ sev: sev, sheet: sheet, addr: addr, msg: msg }); }
    wb.SheetNames.forEach(function (name) {
      var ws = wb.Sheets[name], n = name.toLowerCase();
      if (n.indexOf("beam drawing") >= 0) beamDrawing(ws, name, add);
      else if (n === "main" && /combo|e2k|t[ầa]ng/i.test(JSON.stringify(ws).slice(0, 20000))) etabsTemplate(ws, name, add);
      else if (n.indexOf("column drawing") >= 0 || n.indexOf("wall drawing") >= 0) colWallDrawing(ws, name, add);
    });
    out.summary = summarize(wb);
    return out;
  }
  function beamDrawing(ws, sh, add) {
    ["B2", "B3"].forEach(function (a) { var v = String(cellV(ws, a)); if (v && !RE.scale.test(v)) add("warn", sh, a, "Tỷ lệ \"" + v + "\" nên ghi dạng 1:25"); });
    if (!String(cellV(ws, "B4")).trim()) add("error", sh, "B4", "Chưa nhập Tên dầm");
    ["B6", "B7", "B8"].forEach(function (a) { var v = cellV(ws, a); if (v === "" || isNaN(+v)) add("error", sh, a, "Giá trị phải là số (mm)"); });
    var bt = String(cellV(ws, "B10")); if (bt && !/^\s*\d+\s*\/\s*\d+\s*$/.test(bt)) add("warn", sh, "B10", "BTBV thép chủ/thép đai ghi dạng 30/25");
    ["B12", "B13"].forEach(function (a) { var v = String(cellV(ws, a)); if (v && !RE.rebarMulti.test(v)) add("error", sh, a, "Thép chủ \"" + v + "\" sai định dạng (vd 3d16)"); });
    var c = 2, ended = false, last = "";
    for (; c < 80; c++) {
      var lab = String(cellV(ws, col(c) + "11")).trim(), val = cellV(ws, col(c) + "12");
      if (val === "" || val === null) { ended = true; break; }
      var isG = /^g/i.test(lab.normalize("NFD").replace(/[̀-ͯ]/g, "")), A = col(c);
      if (isNaN(+val)) add("error", sh, A + "12", "Chiều dài " + (isG ? "gối" : "nhịp") + " phải là số (mm)");
      if (last && lab && last === lab) add("warn", sh, A + "11", "Hai cột liền nhau cùng là \"" + lab + "\" – Gối/Nhịp phải xen kẽ");
      last = lab;
      for (var r = 14; r <= 21; r++) { var v = String(cellV(ws, A + r)); if (v && !RE.rebar.test(v) && !RE.rebarMulti.test(v)) add("warn", sh, A + r, "Thép gia cường \"" + v + "\" – dạng 3d16 hoặc trái;phải (3d16;2d18)"); }
      var v22 = String(cellV(ws, A + "22")), v23 = String(cellV(ws, A + "23")), v25 = String(cellV(ws, A + "25")), v24 = String(cellV(ws, A + "24"));
      if (isG) {
        if (v22 && !/^[0-3]$/.test(v22.trim())) add("warn", sh, A + "22", "Gối: loại cột 0/1/2/3 (trống = 0)");
        if (v23 && !RE.sec.test(v23)) add("warn", sh, A + "23", "Dầm giao tại gối \"" + v23 + "\" – dạng 200x500, 200 hoặc 200x500/200x400");
      } else {
        if (v22 && !RE.giatTren.test(v22)) add("warn", sh, A + "22", "Giật mép trên \"" + v22 + "\" – dạng 100, -100 hoặc 100;3d25");
        if (v23 && !/^\s*(\d+\s*x\s*)?\d+\s*d\s*\d+\s*$/i.test(v23)) add("warn", sh, A + "23", "Thép giá \"" + v23 + "\" – dạng 2d12 hoặc 2x2d12");
        if (v24 && !RE.num.test(v24)) add("warn", sh, A + "24", "Giật mép dưới phải là số (+ giật lên, − giật xuống)");
        if (v25 && !RE.stir.test(v25)) add("error", sh, A + "25", "Đai chính \"" + v25 + "\" – dạng 10/100/200 (đk/kc đầu nhịp/kc giữa nhịp)");
      }
    }
    if (c === 2) add("error", sh, "C12", "Bảng Gối/Nhịp trống (hàng 12) – nhập chiều dài từ cột C");
  }
  function etabsTemplate(ws, sh, add) {
    var seen = {};
    for (var r = 4; r < 200; r++) {
      var nm = String(cellV(ws, "F" + r)).trim(), h = cellV(ws, "G" + r);
      if (!nm) break;
      if (/[^\x00-\x7f]/.test(nm)) add("error", sh, "F" + r, "Tên tầng \"" + nm + "\" có dấu tiếng Việt – ETABS sẽ lỗi, ghi không dấu");
      if (/\s/.test(nm)) add("warn", sh, "F" + r, "Tên tầng \"" + nm + "\" có khoảng trắng – nên bỏ");
      if (seen[nm]) add("error", sh, "F" + r, "Tên tầng \"" + nm + "\" bị trùng"); seen[nm] = 1;
      if (h === "" || isNaN(+h)) add("error", sh, "G" + r, "Chiều cao tầng phải là số (m)");
    }
    var names = {};
    [["O", "Q"], ["X", "AA"], ["AC", "AF"], ["AH", "AJ"]].forEach(function (p) {
      for (var r = 4; r < 100; r++) {
        var n = String(cellV(ws, p[0] + r)).trim(); if (!n) continue;
        if (names[n]) add("error", sh, p[0] + r, "Tên tiết diện \"" + n + "\" bị trùng"); names[n] = 1;
        if (!String(cellV(ws, p[1] + r)).trim()) add("warn", sh, p[1] + r, "Tiết diện " + n + " chưa nhập mác bê tông (BT)");
      }
    });
  }
  function colWallDrawing(ws, sh, add) {
    for (var r = 9; r < 300; r++) {
      var nm = String(cellV(ws, "A" + r)).trim(); if (!nm) continue;
      if (!String(cellV(ws, "B" + r)).trim() || !String(cellV(ws, "C" + r)).trim()) add("error", sh, "B" + r, nm + ": thiếu Tầng đầu / Tầng cuối");
      ["K", "L"].forEach(function (cc) { var v = String(cellV(ws, cc + r)); if (v && !RE.tie.test(v)) add("warn", sh, cc + r, nm + ": đai \"" + v + "\" nên ghi dạng T12-100"); });
    }
  }
  function summarize(wb) {
    var s = [];
    wb.SheetNames.slice(0, 8).forEach(function (n) {
      var ws = wb.Sheets[n], ref = ws["!ref"] || "";
      var vals = [];
      Object.keys(ws).filter(function (k) { return k[0] !== "!"; }).slice(0, 60).forEach(function (k) { var v = ws[k].v; if (v !== "" && v != null && String(v).length < 40) vals.push(k + "=" + v); });
      s.push("Sheet " + n + " (" + ref + "): " + vals.join("; "));
    });
    return s.join("\n").slice(0, 3000);
  }
  var API = { check: check };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSAExcel = API;
})(typeof window !== "undefined" ? window : this);
