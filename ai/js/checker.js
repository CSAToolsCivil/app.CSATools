/* CSA AI – Kiểm tra bản vẽ kết cấu (DXF) theo quy tắc MBKC + kinh nghiệm triển khai */
(function (root) {
  "use strict";
  var D = (typeof module !== "undefined" && module.exports) ? require("./dxf.js") : root.CSADXF;

  var OFFICIAL = {
    "KCS-BETONG": { c: 4, lt: "CONTINUOUS" }, "KCS_AXIS": { c: 8, lt: "CENTER" }, "KCS_BORDER": { c: 3, lt: "CONTINUOUS" },
    "KCS_DIM": { c: 8, lt: "CONTINUOUS" }, "KCS_HATCH": { c: 251, lt: "CONTINUOUS" }, "KCS_HIDDEN": { c: 9, lt: "HIDDEN" },
    "KCS_KHONG_IN": { c: 250, lt: "CONTINUOUS", noplot: true }, "KCS_MANH": { c: 8, lt: "CONTINUOUS" }, "KCS_STEEL": { c: 4, lt: "CONTINUOUS" },
    "KCS_STEEL_BOTTOM": { c: 4, lt: "HIDDEN" }, "KCS_STIRRUP": { c: 30, lt: "CONTINUOUS" }, "KCS_TEXT": { c: 60, lt: "CONTINUOUS" },
    "KCS_PLOTTER": { tb: true }, "KCS_TEXT_BANVE_TEN": { tb: true }, "KCS_TEXT_BANVE_SO": { tb: true }
  };
  var TEXT_LAYERS = { "KCS_TEXT": 1, "KCS_AXIS": 1, "KCS_TEXT_BANVE_TEN": 1, "KCS_TEXT_BANVE_SO": 1, "KCS_KHONG_IN": 1 };
  var BEAM_RE = /^D(\d+)-([XY])(\d+)([A-Z]?)\s*\((\d+)\s*[Xx]\s*(\d+)\)$/;
  var BEAM_LOOSE = /^[Dd]\s*\d+\s*-\s*[XYxy]\s*\d+[A-Za-z]?\s*\(\s*\d+\s*[xX×*]\s*\d+\s*\)$/;

  function detectN(dxf, ents) {
    var votes = {};
    function vote(n, w) { if (n > 0 && n < 1000) votes[n] = (votes[n] || 0) + w; }
    Object.keys(dxf.dimstyles).forEach(function (k) { var m = k.match(/^2\.2-(\d+)$/); if (m) vote(+m[1], 5); });
    var lts = dxf.header.$LTSCALE && +dxf.header.$LTSCALE[40];
    if (lts && Math.abs(lts / 10 - Math.round(lts / 10)) < 1e-6) vote(Math.round(lts / 10), 3);
    var ds = dxf.header.$DIMSCALE && +dxf.header.$DIMSCALE[40]; if (ds) vote(Math.round(ds), 2);
    var hs = {};
    ents.forEach(function (e) { if (e.type === "TEXT" && e.h > 0) { var n = Math.round(e.h / 2.2); if (Math.abs(e.h / 2.2 - n) < 0.02 * n) hs[n] = (hs[n] || 0) + 1; } });
    var best = null; Object.keys(hs).forEach(function (k) { if (!best || hs[k] > hs[best]) best = k; }); if (best) vote(+best, 2);
    var top = null; Object.keys(votes).forEach(function (k) { if (!top || votes[k] > votes[top]) top = k; });
    return top ? +top : 100;
  }

  function check(dxf, opt) {
    opt = opt || {};
    var ents = D.explode(dxf);
    var N = opt.N || detectN(dxf, ents);
    var issues = [];
    function add(sev, code, msg, x, y, extra) { issues.push(Object.assign({ sev: sev, code: code, msg: msg, x: x, y: y }, extra || {})); }
    var tol = function (v, ref, pct) { return Math.abs(v - ref) <= Math.max(Math.abs(ref) * (pct || 0.03), 1e-6); };

    // ---------- 1. LAYER ----------
    var used = {};
    ents.forEach(function (e) { used[e.layer] = (used[e.layer] || 0) + 1; });
    Object.keys(OFFICIAL).forEach(function (nm) {
      var L = dxf.layers[nm], R = OFFICIAL[nm];
      if (!L) { if (!R.tb && (nm === "KCS_AXIS" || nm === "KCS_BORDER" || nm === "KCS_DIM" || nm === "KCS_TEXT")) add("warn", "LAYER_MISSING", "Thiếu layer chuẩn " + nm); return; }
      if (R.tb) return;
      if (Math.abs(L.color) !== R.c) add("error", "LAYER_COLOR", "Layer " + nm + " màu " + Math.abs(L.color) + " – quy định màu " + R.c);
      if (String(L.linetype).toUpperCase() !== R.lt) add("error", "LAYER_LTYPE", "Layer " + nm + " kiểu nét " + L.linetype + " – quy định " + R.lt);
      if (R.noplot && L.plot !== 0) add("error", "LAYER_PLOT", "Layer KCS_KHONG_IN phải tắt in (No Plot)");
      if (!R.noplot && L.plot === 0) add("warn", "LAYER_PLOT", "Layer " + nm + " đang tắt in – chỉ KCS_KHONG_IN được tắt in");
      if (L.flags & 1) add("warn", "LAYER_FROZEN", "Layer " + nm + " đang Freeze");
      if (L.flags & 4) add("warn", "LAYER_LOCK", "Layer " + nm + " đang Lock");
    });
    Object.keys(used).forEach(function (nm) {
      if (OFFICIAL[nm] || /^defpoints$/i.test(nm)) return;
      var m = nm.match(/^(KCS_TEXT|KCS_AXIS|KCS_HATCH)./i);
      var first = ents.find(function (e) { return e.layer === nm; });
      var p = anchor(first);
      if (m) add("warn", "LAYER_GROUP", "Layer mở rộng \"" + nm + "\" (" + used[nm] + " đối tượng) – quy về layer chung " + m[1].toUpperCase(), p.x, p.y, { layer: nm });
      else if (nm === "0") add("warn", "LAYER_0", used[nm] + " đối tượng nằm trên layer 0", p.x, p.y, { layer: nm });
      else add("warn", "LAYER_NONSTD", "Layer ngoài bộ chuẩn: \"" + nm + "\" (" + used[nm] + " đối tượng)", p.x, p.y, { layer: nm });
    });
    if (dxf.layers["KCS_BETONG"]) add("error", "LAYER_NAME", "Có layer KCS_BETONG (gạch dưới) – tên đúng là KCS-BETONG (gạch ngang)");

    // ---------- 2. HEADER / LTSCALE ----------
    var lts = dxf.header.$LTSCALE ? +dxf.header.$LTSCALE[40] : null;
    if (lts != null && !tol(lts, 10 * N, 0.001)) add("error", "LTSCALE", "LTSCALE = " + lts + " – tỷ lệ 1:" + N + " phải đặt LTSCALE = " + (10 * N));
    var cel = dxf.header.$CELTSCALE ? +dxf.header.$CELTSCALE[40] : null;
    if (cel != null && cel !== 1) add("warn", "CELTSCALE", "CELTSCALE = " + cel + " – quy định = 1");
    var badLts = ents.filter(function (e) { return e.src && e.src.ltscale && Math.abs(e.src.ltscale - 1) > 1e-6 && !e.blk; });
    if (badLts.length) { var b0 = anchor(badLts[0]); add("warn", "OBJ_LTSCALE", badLts.length + " đối tượng có Linetype scale riêng ≠ 1", b0.x, b0.y); }

    // ---------- 3. TEXT ----------
    var texts = ents.filter(function (e) { return e.type === "TEXT"; });
    var std = [2.2, 3.0, 3.2, 4.5];
    var mtext = 0, lower = [], badH = [], badStyle = {}, badLayer = [];
    texts.forEach(function (t) {
      if (t.kind === "MTEXT") { mtext++; if (mtext <= 30) add("error", "MTEXT", "Dùng MText \"" + short(t.text) + "\" – quy định dùng DText", t.x, t.y); }
      if (/[a-zà-ỹđ]/.test(t.text)) lower.push(t);
      var hp = t.h / N;
      if (!std.some(function (s) { return Math.abs(hp - s) <= 0.06; })) badH.push(t);
      var st = dxf.styles[t.style];
      if (st && !/arial/i.test(st.font + " " + st.name)) badStyle[t.style] = (badStyle[t.style] || 0) + 1;
      var wfExp = Math.abs(hp - 4.5) <= 0.06 ? 1.0 : 0.7;
      var wf = t.wf && t.wf !== 1 ? t.wf : (st ? st.width : 1);
      if (Math.abs(wf - wfExp) > 0.02 && t.kind !== "MTEXT") add("warn", "TEXT_WF", "Chữ \"" + short(t.text) + "\" width factor " + round(wf, 2) + " – quy định " + wfExp, t.x, t.y);
      if (!TEXT_LAYERS[t.layer] && !t.blk) badLayer.push(t);
    });
    if (mtext > 30) add("error", "MTEXT", "Tổng cộng " + mtext + " MText trên bản vẽ");
    lower.slice(0, 40).forEach(function (t) { add("warn", "TEXT_CASE", "Chữ thường: \"" + short(t.text) + "\" – toàn bộ chữ viết HOA", t.x, t.y); });
    if (lower.length > 40) add("warn", "TEXT_CASE", "Còn " + (lower.length - 40) + " chữ thường khác");
    badH.slice(0, 40).forEach(function (t) { add("warn", "TEXT_H", "Chữ \"" + short(t.text) + "\" cao " + round(t.h, 1) + " (= " + round(t.h / N, 2) + " mm giấy) – chuẩn 2.2 / 3.0 / 3.2 / 4.5 mm × N", t.x, t.y); });
    Object.keys(badStyle).forEach(function (s) { add("warn", "TEXT_FONT", "Text style \"" + s + "\" không dùng Arial (" + badStyle[s] + " chữ)"); });
    badLayer.slice(0, 30).forEach(function (t) { add("warn", "TEXT_LAYER", "Chữ \"" + short(t.text) + "\" nằm layer " + t.layer + " – chữ thuộc KCS_TEXT (chữ trục: KCS_AXIS)", t.x, t.y); });

    // overlap (grid bucket)
    var boxes = texts.filter(function (t) { return t.text.trim(); }).map(function (t) { return { t: t, b: D.textBox(t) }; });
    var dims = ents.filter(function (e) { return e.type === "DIM"; });
    dims.forEach(function (d) {
      var s = d.src, val = isNaN(s.meas) ? "" : String(Math.round(s.meas));
      if (s.over && s.over !== "<>") val = D.decodeU(s.over).replace(/<>/g, val);
      var h = 2.2 * N, w = D.textWidth(val) * h * 0.7, horiz = Math.abs(Math.cos((s.rotd || 0) * Math.PI / 180)) > 0.7 && Math.abs(d.y1 - d.y2) < Math.abs(d.x1 - d.x2) + 1;
      var bx = horiz ? { x1: d.tx - w / 2, x2: d.tx + w / 2, y1: d.ty - h / 2, y2: d.ty + h / 2 } : { x1: d.tx - h / 2, x2: d.tx + h / 2, y1: d.ty - w / 2, y2: d.ty + w / 2 };
      if (val) boxes.push({ t: { text: val, x: d.tx, y: d.ty, dim: true }, b: bx });
    });
    var cell = 30 * N, grid = {}, overlaps = 0;
    boxes.forEach(function (o, i) {
      var gx1 = Math.floor(o.b.x1 / cell), gx2 = Math.floor(o.b.x2 / cell), gy1 = Math.floor(o.b.y1 / cell), gy2 = Math.floor(o.b.y2 / cell), seen = {};
      for (var gx = gx1; gx <= gx2; gx++) for (var gy = gy1; gy <= gy2; gy++) {
        var k = gx + "," + gy; (grid[k] = grid[k] || []).forEach(function (j) {
          if (seen[j]) return; seen[j] = 1;
          var p = boxes[j];
          if (D.boxOverlap(o.b, p.b, 0.15 * N) && !(o.t.x === p.t.x && o.t.y === p.t.y && o.t.text === p.t.text)) {
            overlaps++;
            if (overlaps <= 40) add("error", "TEXT_OVERLAP", "Chồng chữ: \"" + short(o.t.text) + "\" × \"" + short(p.t.text) + "\"", (o.t.x + p.t.x) / 2, (o.t.y + p.t.y) / 2);
          }
        });
        grid[k].push(i);
      }
    });
    if (overlaps > 40) add("error", "TEXT_OVERLAP", "Còn " + (overlaps - 40) + " vị trí chồng chữ khác");

    // ---------- 4. DIM ----------
    var dimStyleUse = {};
    dims.forEach(function (d) {
      var s = d.src; dimStyleUse[s.style] = (dimStyleUse[s.style] || 0) + 1;
      if (d.layer !== "KCS_DIM" && !d.blk) add("warn", "DIM_LAYER", "DIM nằm layer " + d.layer + " – quy định KCS_DIM", d.tx, d.ty);
      if (s.over && s.over !== "<>" && s.over.indexOf("<>") < 0 && /\d/.test(s.over)) {
        var real = isNaN(s.meas) ? "?" : String(Math.round(s.meas));
        add("error", "DIM_FAKE", "DIM bị ghi đè số \"" + D.decodeU(s.over) + "\" (đo thật " + real + ") – không sửa số DIM bằng text", d.tx, d.ty);
      }
    });
    Object.keys(dimStyleUse).forEach(function (st) {
      var m = st.match(/^2\.2-(\d+)$/);
      if (!m) { add("warn", "DIM_STYLE", "DIM style \"" + st + "\" (" + dimStyleUse[st] + " DIM) – quy định style 2.2-" + N); return; }
      if (+m[1] !== N) add("warn", "DIM_STYLE", "DIM style " + st + " khác tỷ lệ bản vẽ 1:" + N);
      var r = dxf.dimstyles[st]; if (!r) return;
      var want = { 40: [+m[1], "DIMSCALE"], 140: [2.2, "DIMTXT"], 178: [60, "DIMCLRT (màu chữ)"], 176: [8, "DIMCLRD (màu đường DIM)"], 177: [8, "DIMCLRE (màu đường dóng)"],
        147: [1, "DIMGAP"], 43: [6, "DIMDLI"], 44: [1, "DIMEXE"], 42: [1, "DIMEXO"], 41: [1, "DIMASZ"], 271: [0, "DIMDEC"], 144: [1, "DIMLFAC"] };
      Object.keys(want).forEach(function (code) {
        if (r[code] === undefined) return;
        if (Math.abs(+r[code] - want[code][0]) > 1e-6) add("error", "DIM_VAR", "Style " + st + ": " + want[code][1] + " = " + r[code] + " – quy định " + want[code][0]);
      });
    });

    // ---------- 5. TRỤC ----------
    var axisLines = ents.filter(function (e) { return e.layer === "KCS_AXIS" && e.type === "LINE"; });
    var bubbles = ents.filter(function (e) { return e.type === "CIRCLE" && Math.abs(e.r - 3.2 * N) <= 0.15 * N; });
    bubbles.forEach(function (c) {
      if (c.layer !== "KCS_MANH") add("warn", "AXIS_CIRCLE_LAYER", "Vòng tròn trục nằm layer " + c.layer + " – quy định KCS_MANH", c.x, c.y);
      var lab = texts.filter(function (t) { return Math.hypot(t.x - c.x, t.y - c.y) < c.r * 1.2; })[0];
      if (!lab) return;
      if (lab.layer !== "KCS_AXIS") add("warn", "AXIS_TEXT_LAYER", "Chữ trục \"" + lab.text + "\" nằm layer " + lab.layer + " – quy định KCS_AXIS", c.x, c.y);
      if (Math.hypot(lab.x - c.x, lab.y - c.y) > 0.3 * N && lab.kind !== "MTEXT") add("warn", "AXIS_TEXT_ALIGN", "Chữ trục \"" + lab.text + "\" chưa căn MC đúng tâm vòng tròn", c.x, c.y);
      if (Math.abs(lab.h - 3.2 * N) > 0.1 * N) add("warn", "AXIS_TEXT_H", "Chữ trục \"" + lab.text + "\" cao " + round(lab.h / N, 2) + " mm giấy – quy định 3.2 mm", c.x, c.y);
    });
    var otherCircles = ents.filter(function (e) { return e.type === "CIRCLE" && e.layer === "KCS_MANH" && e.r > 2 * N && e.r < 8 * N && Math.abs(e.r - 3.2 * N) > 0.15 * N; });
    if (otherCircles.length) add("warn", "AXIS_R", otherCircles.length + " vòng tròn trục bán kính khác 3.2 mm giấy (R = " + round(otherCircles[0].r / N, 2) + " mm)", otherCircles[0].x, otherCircles[0].y);
    if (axisLines.length && !dxf.blocks["LUOITRUC"]) add("warn", "AXIS_BLOCK", "Lưới trục chưa đóng block LUOITRUC (trục + chữ + vòng tròn + DIM tổng + DIM trục)");

    // phân tích lưới trục để kiểm tra DIM
    var ax = analyseAxes(ents, N);
    if (ax.xs.length >= 2 || ax.ys.length >= 2) {
      var hd = dims.filter(function (d) { return Math.abs(d.y1 - d.y2) < 1 || isHorizDim(d); });
      var vd = dims.filter(function (d) { return Math.abs(d.x1 - d.x2) < 1 || isVertDim(d); });
      function hasDim(list, a, b, horiz) {
        return list.some(function (d) {
          var p = horiz ? [d.x1, d.x2] : [d.y1, d.y2]; p.sort(function (u, v) { return u - v; });
          return Math.abs(p[0] - a) < 2 && Math.abs(p[1] - b) < 2;
        });
      }
      for (var i = 0; i + 1 < ax.xs.length; i++) if (!hasDim(hd, ax.xs[i], ax.xs[i + 1], true)) add("warn", "DIM_AXIS_MISSING", "Thiếu DIM trục–trục theo phương X giữa 2 trục tại x=" + round(ax.xs[i]) + " → " + round(ax.xs[i + 1]), (ax.xs[i] + ax.xs[i + 1]) / 2, ax.box.y1);
      for (i = 0; i + 1 < ax.ys.length; i++) if (!hasDim(vd, ax.ys[i], ax.ys[i + 1], false)) add("warn", "DIM_AXIS_MISSING", "Thiếu DIM trục–trục theo phương Y giữa y=" + round(ax.ys[i]) + " → " + round(ax.ys[i + 1]), ax.box.x1, (ax.ys[i] + ax.ys[i + 1]) / 2);
      if (ax.xs.length > 2 && !hasDim(hd, ax.xs[0], ax.xs[ax.xs.length - 1], true)) add("warn", "DIM_TOTAL", "Thiếu DIM tổng trục đầu–trục cuối phương X", (ax.box.x1 + ax.box.x2) / 2, ax.box.y1);
      if (ax.ys.length > 2 && !hasDim(vd, ax.ys[0], ax.ys[ax.ys.length - 1], false)) add("warn", "DIM_TOTAL", "Thiếu DIM tổng trục đầu–trục cuối phương Y", ax.box.x1, (ax.box.y1 + ax.box.y2) / 2);
      var side = { top: 0, bottom: 0, left: 0, right: 0 };
      dims.forEach(function (d) {
        if (d.dy > ax.box.y2 + 2 * N) side.top++; if (d.dy < ax.box.y1 - 2 * N) side.bottom++;
        if (d.dx < ax.box.x1 - 2 * N) side.left++; if (d.dx > ax.box.x2 + 2 * N) side.right++;
      });
      var vn = { top: "trên", bottom: "dưới", left: "trái", right: "phải" };
      Object.keys(side).forEach(function (k) { if (!side[k]) add("warn", "DIM_SIDE", "Chưa có DIM phía " + vn[k] + " mặt bằng (MBKC cần DIM 4 phía)"); });
    }

    // ---------- 6. CỘT ----------
    var hatches = ents.filter(function (e) { return e.type === "HATCH"; });
    var lines = ents.filter(function (e) { return e.type === "LINE"; });
    var cols = ents.filter(function (e) { return e.layer === "KCS-BETONG" && e.type === "PLINE"; });
    cols.forEach(function (c) {
      if (!c.closed) { var a = c.pts[0]; add("warn", "COL_OPEN", "Nét bao cột/vách KCS-BETONG chưa khép kín", a.x, a.y); return; }
      var b = D.bboxPts(c.pts), cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2, w = b.x2 - b.x1, h = b.y2 - b.y1;
      if (Math.min(w, h) < 200 - 1) add("warn", "COL_SMALL", "Cột/vách kích thước " + round(w) + "×" + round(h) + " < 200 mm – kiểm tra lại", cx, cy);
      c._box = b;
    });
    var colLabels = texts.filter(function (t) { return /^C[A-Z]?\d+/.test(t.text.trim()); });
    if (colLabels.length) {
      cols.forEach(function (c) {
        if (!c._box) return; var b = c._box, cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
        var hatched = hatches.some(function (h) { if (!h.pts.length) return false; var hb = D.bboxPts(h.pts); return hb.x1 >= b.x1 - 5 && hb.x2 <= b.x2 + 5 && hb.y1 >= b.y1 - 5 && hb.y2 <= b.y2 + 5; });
        var diag = lines.filter(function (l) { return inBox(l.x1, l.y1, b, 5) && inBox(l.x2, l.y2, b, 5) && Math.abs(l.x1 - l.x2) > 0.3 * (b.x2 - b.x1) && Math.abs(l.y1 - l.y2) > 0.3 * (b.y2 - b.y1); });
        if (!hatched && diag.length === 0) add("warn", "COL_STATE", "Cột không hatch và không có dấu X – thiếu ký hiệu trạng thái lên tiếp/dừng (MB định vị cột)", cx, cy);
        if (!hatched && diag.length === 1) add("error", "COL_STOP_X", "Cột dừng chỉ có 1 nét chéo – phải có 2 LINE chéo thành dấu X", cx, cy);
        var near = colLabels.some(function (t) { return Math.hypot(t.x - cx, t.y - cy) < Math.max(b.x2 - b.x1, b.y2 - b.y1) + 25 * N; });
        if (!near) add("warn", "COL_NAME", "Cột chưa có tên gần đó", cx, cy);
      });
      colLabels.forEach(function (t) {
        if (Math.abs(t.h - 3 * N) > 0.1 * N) add("warn", "COL_NAME_H", "Tên cột \"" + t.text + "\" cao " + round(t.h / N, 2) + " mm giấy – quy định 3 mm Arial Bold", t.x, t.y);
      });
    }

    // ---------- 7. LỖ MỞ ----------
    var border = ents.filter(function (e) { return e.type === "PLINE" && e.closed && e.layer === "KCS_BORDER" && D.isRect(e.pts, 2); });
    var manh = lines.filter(function (l) { return l.layer === "KCS_MANH"; });
    var openings = 0;
    border.forEach(function (p) {
      var b = D.bboxPts(p.pts), area = (b.x2 - b.x1) * (b.y2 - b.y1) / 1e6;
      var corners = [[b.x1, b.y1, b.x2, b.y2], [b.x1, b.y2, b.x2, b.y1]];
      var found = corners.map(function (c) {
        return lines.filter(function (l) { return (near2(l.x1, l.y1, c[0], c[1], 5) && near2(l.x2, l.y2, c[2], c[3], 5)) || (near2(l.x2, l.y2, c[0], c[1], 5) && near2(l.x1, l.y1, c[2], c[3], 5)); });
      });
      var nd = (found[0].length ? 1 : 0) + (found[1].length ? 1 : 0);
      if (nd === 0) return;
      openings++;
      var cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
      if (nd === 1) add("error", "OPEN_X", "Lỗ mở chỉ có 1 nét chéo – cần 2 LINE chéo thành dấu X", cx, cy);
      found.forEach(function (f) { f.forEach(function (l) { if (l.layer !== "KCS_MANH") add("warn", "OPEN_X_LAYER", "Nét chéo lỗ mở nằm layer " + l.layer + " – quy định KCS_MANH", cx, cy); }); });
      var inner = texts.filter(function (t) { return t.x > b.x1 && t.x < b.x2 && t.y > b.y1 && t.y < b.y2; });
      if (inner.length) add("warn", "OPEN_TEXT", "Có chữ \"" + short(inner[0].text) + "\" ghi tại lỗ mở – quy định chỉ dùng mẫu chung KÝ HIỆU LỖ MỞ", cx, cy);
      if (area > 2) {
        var edges = [["h", b.y1, b.x1, b.x2], ["h", b.y2, b.x1, b.x2], ["v", b.x1, b.y1, b.y2], ["v", b.x2, b.y1, b.y2]];
        var miss = edges.filter(function (ed) {
          return !lines.concat(plineSegs(ents)).some(function (l) {
            if (l.layer !== "KCS_BORDER" && l.layer !== "KCS_HIDDEN") return false;
            if (ed[0] === "h") return Math.abs(l.y1 - l.y2) < 1 && Math.abs(l.y1 - ed[1]) > 50 && Math.abs(l.y1 - ed[1]) < 600 && Math.min(l.x1, l.x2) <= ed[2] + 10 && Math.max(l.x1, l.x2) >= ed[3] - 10;
            return Math.abs(l.x1 - l.x2) < 1 && Math.abs(l.x1 - ed[1]) > 50 && Math.abs(l.x1 - ed[1]) < 600 && Math.min(l.y1, l.y2) <= ed[2] + 10 && Math.max(l.y1, l.y2) >= ed[3] - 10;
          });
        });
        if (miss.length >= 2) add("warn", "OPEN_BEAM", "Lỗ mở " + round(area, 2) + " m² (> 2 m²) – chưa thấy đủ dầm bao quanh (" + miss.length + "/4 cạnh)", cx, cy);
      }
    });
    if (openings && !texts.some(function (t) { return /K[ÝY] HI[ỆE]U L[ỖO] M[ỞO]/i.test(t.text); })) add("warn", "OPEN_LEGEND", "Có " + openings + " lỗ mở nhưng chưa có mẫu chung \"KÝ HIỆU LỖ MỞ\"");

    // ---------- 8. NHÃN DẦM ----------
    var beamLabels = [];
    texts.forEach(function (t) {
      var s = t.text.trim();
      var m = s.match(BEAM_RE);
      if (!m && BEAM_LOOSE.test(s)) { add("warn", "BEAM_FMT", "Nhãn dầm \"" + s + "\" sai định dạng – mẫu D2-X1 (22X40)", t.x, t.y); return; }
      if (!m) return;
      var bl = { t: t, floor: +m[1], dir: m[2], no: +m[3], suf: m[4], b: +m[5], h: +m[6], name: "D" + m[1] + "-" + m[2] + m[3] + m[4] };
      beamLabels.push(bl);
      if (Math.abs(t.h - 2.2 * N) > 0.1 * N) add("warn", "BEAM_H", "Nhãn " + s + " cao " + round(t.h / N, 2) + " mm giấy – quy định 2.2 mm", t.x, t.y);
      if (t.layer !== "KCS_TEXT") add("warn", "BEAM_LAYER", "Nhãn " + s + " nằm layer " + t.layer + " – quy định KCS_TEXT", t.x, t.y);
      if (bl.h < 40) add("warn", "BEAM_RULE_H", "Dầm " + s + ": h = " + bl.h * 10 + " < 400 mm – quy tắc hiện hành h tối thiểu 400 (quy định cũ h = 300 đã thay)", t.x, t.y);
      if (bl.h % 5) add("warn", "BEAM_RULE_H50", "Dầm " + s + ": h không phải bội 50 mm", t.x, t.y);
      if (bl.b < 20) add("warn", "BEAM_B", "Dầm " + s + ": b = " + bl.b * 10 + " mm < 200 mm", t.x, t.y);
      if (bl.h / bl.b > 4) add("warn", "BEAM_RATIO", "Dầm " + s + ": h/b = " + round(bl.h / bl.b, 1) + " > 4 – kiểm tra ổn định ngang", t.x, t.y);
      // so khớp nhãn với nét dầm
      var g = beamGeom(t, ents, N);
      if (g) {
        if (Math.abs(g.width - bl.b * 10) > 15) add("error", "BEAM_GEOM", "Nhãn " + s + " ghi b = " + bl.b * 10 + " nhưng nét dầm cách nhau " + round(g.width) + " mm", t.x, t.y);
        var gap = (g.near - t.h / 2) / N;
        if (gap > 3 || gap < 0.3) add("warn", "BEAM_GAP", "Nhãn " + s + " cách biên dầm " + round(gap, 1) + " mm giấy – quy định 1 mm", t.x, t.y);
      }
    });
    // thứ tự đánh số
    ["X", "Y"].forEach(function (dir) {
      var first = {};
      beamLabels.filter(function (b) { return b.dir === dir; }).forEach(function (b) { var k = b.floor + "-" + b.no; if (!first[k]) first[k] = b; });
      var arr = Object.keys(first).map(function (k) { return first[k]; }).sort(function (a, b) { return a.floor - b.floor || a.no - b.no; });
      var bad = 0;
      for (var i = 1; i < arr.length; i++) {
        if (arr[i].floor !== arr[i - 1].floor) continue;
        var A = arr[i - 1].t, B = arr[i].t;
        if (dir === "X" && B.y > A.y + 50 * N) bad++;
        if (dir === "Y" && B.x < A.x - 50 * N) bad++;
      }
      if (bad) add("warn", "BEAM_ORDER", "Đánh số dầm phương " + dir + " chưa theo thứ tự " + (dir === "X" ? "trên → dưới" : "trái → phải") + " (" + bad + " chỗ đảo)");
    });

    // ---------- 9. KÝ HIỆU SÀN ----------
    var elev = texts.filter(function (t) { return /^[+-]\d+[.,]\d{3}$/.test(t.text.trim()); });
    var thick = texts.filter(function (t) { return /^\d{2,3}\s*MM$/i.test(t.text.trim()); });
    elev.forEach(function (e) {
      var pair = thick.some(function (t) { return Math.abs(t.x - e.x) < 2 * N && e.y - t.y > 1 * N && e.y - t.y < 8 * N; });
      if (!pair && thick.length) add("warn", "SLAB_SYMBOL", "Cao độ " + e.text + " chưa có ô chiều dày ngay bên dưới (khung ký hiệu sàn)", e.x, e.y);
      if (/,/.test(e.text)) add("warn", "SLAB_ELEV_FMT", "Cao độ \"" + e.text + "\" dùng dấu phẩy – ghi dạng +3.550", e.x, e.y);
    });
    thick.forEach(function (t) { if (/mm/.test(t.text)) add("warn", "SLAB_MM", "Chiều dày \"" + t.text + "\" phải viết hoa MM", t.x, t.y); });

    // ---------- 10. KHUNG TÊN ----------
    var plotterInBlock = Object.keys(dxf.blocks).filter(function (k) { return (dxf.blocks[k].entities || []).some(function (e) { return e.layer === "KCS_PLOTTER"; }); });
    plotterInBlock.forEach(function (k) { if (!/^\*/.test(k)) add("error", "TB_PLOTTER_BLOCK", "LINE KCS_PLOTTER nằm trong block \"" + k + "\" – phải nằm ngoài block"); });
    var tbBlocks = Object.keys(dxf.blocks).filter(function (k) { return /^A[0-4]_?KC_?\d+$/i.test(k); });
    if (tbBlocks.length > 1) add("warn", "TB_BLOCKS", "Có " + tbBlocks.length + " block khung tên riêng (" + tbBlocks.slice(0, 4).join(", ") + "…) – các tờ cùng mẫu dùng 1 định nghĩa block chung");
    var soBV = texts.filter(function (t) { return t.layer === "KCS_TEXT_BANVE_SO"; });
    soBV.forEach(function (t) { if (!/^KC-\d+$/.test(t.text.trim())) add("warn", "TB_NO", "Số bản vẽ \"" + t.text + "\" – định dạng KC-1, KC-2…", t.x, t.y); });
    var nums = soBV.map(function (t) { var m = t.text.match(/KC-(\d+)/); return m ? +m[1] : null; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
    for (var q = 1; q < nums.length; q++) if (nums[q] !== nums[q - 1] + 1) { add("warn", "TB_SEQ", "Số bản vẽ không liên tục: KC-" + nums[q - 1] + " → KC-" + nums[q]); break; }
    var tenBV = texts.filter(function (t) { return t.layer === "KCS_TEXT_BANVE_TEN"; });
    var titles = texts.filter(function (t) { return Math.abs(t.h / N - 4.5) <= 0.1 && t.layer === "KCS_TEXT"; });
    tenBV.forEach(function (t) {
      var nm = D.norm(t.text).replace(/\s+/g, " ").trim();
      if (titles.length && !titles.some(function (x) { return D.norm(x.text).replace(/\s+/g, " ").trim() === nm; })) add("warn", "TB_NAME", "Tên bản vẽ trong khung \"" + short(t.text) + "\" không trùng tiêu đề bản vẽ", t.x, t.y);
    });
    titles.forEach(function (t) { if (!/^%%u/i.test(t.src && t.src.raw || "") && t.kind !== "MTEXT") add("info", "TITLE_UL", "Tiêu đề \"" + short(t.text) + "\" chưa gạch chân (%%U)", t.x, t.y); });

    // ---------- 11. HATCH ----------
    var pats = {};
    hatches.forEach(function (h) {
      if (!h.pts.length) return;
      var b = D.bboxPts(h.pts), a = (b.x2 - b.x1) * (b.y2 - b.y1);
      var k = h.pattern + "|" + round(h.src.scale, 3) + "|" + round(h.src.angle, 1);
      (pats[k] = pats[k] || []).push({ a: a, b: b });
      if (h.layer !== "KCS_HATCH" && !h.blk) add("warn", "HATCH_LAYER", "Hatch " + h.pattern + " nằm layer " + h.layer + " – quy định KCS_HATCH", (b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2);
    });
    var slabPats = Object.keys(pats).filter(function (k) { return /^(ANSI37|ANGLE)\|/.test(k); });
    slabPats.forEach(function (k) {
      var arr = pats[k]; var small = arr.some(function (o) { return o.a < 400 * N * N; }), big = arr.some(function (o) { return o.a >= 400 * N * N; });
      if (big && !small) add("warn", "HATCH_LEGEND", "Hatch sàn " + k.split("|")[0] + " (scale " + k.split("|")[1] + ") chưa có ô chú giải cùng mẫu/góc/mật độ");
    });

    // ---------- 12. VỆ SINH BẢN VẼ ----------
    var zero = lines.filter(function (l) { return Math.hypot(l.x2 - l.x1, l.y2 - l.y1) < 0.01 && !l.blk; });
    if (zero.length) add("warn", "ZERO_LINE", zero.length + " đoạn thẳng chiều dài 0", zero[0].x1, zero[0].y1);
    var seen = {}, dup = 0, dupAt = null;
    lines.forEach(function (l) {
      if (l.blk) return;
      var a = round(l.x1, 1) + "," + round(l.y1, 1), b = round(l.x2, 1) + "," + round(l.y2, 1), k = l.layer + "|" + (a < b ? a + "|" + b : b + "|" + a);
      if (seen[k]) { dup++; if (!dupAt) dupAt = l; } else seen[k] = 1;
    });
    if (dup) add("warn", "DUP_LINE", dup + " đoạn thẳng trùng lặp (vẽ chồng) – nên OVERKILL", dupAt.x1, dupAt.y1);
    var colored = ents.filter(function (e) { return e.src && e.src.color !== 256 && e.src.color !== 0 && !e.blk && e.type !== "DIM"; });
    if (colored.length) add("info", "COLOR_OVERRIDE", colored.length + " đối tượng gán màu riêng (không ByLayer)", anchor(colored[0]).x, anchor(colored[0]).y);

    // ---------- tổng hợp ----------
    issues.forEach(function (it, i) { it.no = i + 1; });
    var stat = { error: 0, warn: 0, info: 0 }; issues.forEach(function (i) { stat[i.sev]++; });
    return { N: N, issues: issues, stat: stat, counts: { entities: ents.length, texts: texts.length, dims: dims.length, beams: beamLabels.length, columns: cols.length, openings: openings, axesX: ax.xs.length, axesY: ax.ys.length },
      layersUsed: used, ents: ents, axes: ax };
  }

  // ---------- helpers ----------
  function anchor(e) {
    if (!e) return { x: undefined, y: undefined };
    if (e.type === "LINE") return { x: e.x1, y: e.y1 }; if (e.type === "PLINE" || e.type === "HATCH") return e.pts.length ? e.pts[0] : {};
    if (e.type === "DIM") return { x: e.tx, y: e.ty }; return { x: e.x, y: e.y };
  }
  function short(s) { s = String(s).replace(/\s+/g, " "); return s.length > 28 ? s.slice(0, 27) + "…" : s; }
  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }
  function inBox(x, y, b, t) { return x >= b.x1 - t && x <= b.x2 + t && y >= b.y1 - t && y <= b.y2 + t; }
  function near2(x1, y1, x2, y2, t) { return Math.abs(x1 - x2) <= t && Math.abs(y1 - y2) <= t; }
  function isHorizDim(d) { return Math.abs(Math.sin((d.src.rotd || 0) * Math.PI / 180)) < 0.01 && d.src.dimtype <= 1; }
  function isVertDim(d) { return Math.abs(Math.cos((d.src.rotd || 0) * Math.PI / 180)) < 0.01 && d.src.dimtype <= 1; }
  function plineSegs(ents) {
    var out = [];
    ents.forEach(function (e) {
      if (e.type !== "PLINE") return;
      for (var i = 0; i < e.pts.length - (e.closed ? 0 : 1); i++) { var a = e.pts[i], b = e.pts[(i + 1) % e.pts.length]; out.push({ layer: e.layer, x1: a.x, y1: a.y, x2: b.x, y2: b.y }); }
    });
    return out;
  }
  function analyseAxes(ents, N) {
    var ls = ents.filter(function (e) { return e.layer === "KCS_AXIS" && e.type === "LINE" && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) > 30 * N; });
    var xs = [], ys = [];
    ls.forEach(function (l) {
      if (Math.abs(l.x1 - l.x2) < 1) xs.push((l.x1 + l.x2) / 2); else if (Math.abs(l.y1 - l.y2) < 1) ys.push((l.y1 + l.y2) / 2);
    });
    function uniq(a) { a.sort(function (u, v) { return u - v; }); var o = []; a.forEach(function (v) { if (!o.length || v - o[o.length - 1] > 5) o.push(v); }); return o; }
    xs = uniq(xs); ys = uniq(ys);
    var box = { x1: xs.length ? xs[0] : 0, x2: xs.length ? xs[xs.length - 1] : 0, y1: ys.length ? ys[0] : 0, y2: ys.length ? ys[ys.length - 1] : 0 };
    return { xs: xs, ys: ys, box: box };
  }
  function beamGeom(t, ents, N) {
    var r = ((t.rot || 0) % 180 + 180) % 180, horiz = r < 10 || r > 170, vert = Math.abs(r - 90) < 10;
    if (!horiz && !vert) return null;
    var cand = [];
    ents.forEach(function (e) {
      var segs = e.type === "LINE" ? [e] : e.type === "PLINE" ? plineSegs([e]) : [];
      segs.forEach(function (s) {
        var L = e.layer; if (L !== "KCS_BORDER" && L !== "KCS_HIDDEN") return;
        if (horiz && Math.abs(s.y1 - s.y2) < 0.5 && Math.min(s.x1, s.x2) - 5 <= t.x && Math.max(s.x1, s.x2) + 5 >= t.x) cand.push(s.y1 - t.y);
        if (vert && Math.abs(s.x1 - s.x2) < 0.5 && Math.min(s.y1, s.y2) - 5 <= t.y && Math.max(s.y1, s.y2) + 5 >= t.y) cand.push(s.x1 - t.x);
      });
    });
    var pos = cand.filter(function (o) { return o > 0; }).sort(function (a, b) { return a - b; });
    var neg = cand.filter(function (o) { return o < 0; }).map(function (o) { return -o; }).sort(function (a, b) { return a - b; });
    var best = null;
    [pos, neg].forEach(function (arr) {
      if (arr.length < 2) return;
      var o1 = arr[0];
      if (o1 > 6 * N) return;
      for (var i = 1; i < arr.length; i++) { var w = arr[i] - o1; if (w >= 100 && w <= 700) { if (!best || o1 < best.near) best = { near: o1, width: w }; break; } }
    });
    return best;
  }

  // ---------- xuất LISP đánh dấu lỗi ----------
  function toLisp(res) {
    var N = res.N, L = [];
    function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, "'").replace(/[^\x20-\x7e]/g, function (ch) { return "\\\\U+" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"); }); }
    L.push(";; CSA AI - danh dau loi kiem tra ban ve. Lenh: CSACHECK  (xoa dau: CSACHECKCLEAR)");
    L.push("(defun csa-ck-layer () (if (not (tblsearch \"LAYER\" \"CSA_CHECK\")) (entmake '((0 . \"LAYER\") (100 . \"AcDbSymbolTableRecord\") (100 . \"AcDbLayerTableRecord\") (2 . \"CSA_CHECK\") (70 . 0) (62 . 1) (6 . \"Continuous\") (290 . 0)))))");
    L.push("(defun csa-ck (x y n msg col) (entmake (list '(0 . \"CIRCLE\") '(8 . \"CSA_CHECK\") (cons 62 col) (list 10 x y 0.0) (cons 40 " + (6 * N) + ")))" +
      " (entmake (list '(0 . \"TEXT\") '(8 . \"CSA_CHECK\") (cons 62 col) (list 10 (+ x " + (7 * N) + ") (+ y " + (1 * N) + ") 0.0) (cons 40 " + (2.5 * N) + ") (cons 1 (strcat \"#\" (itoa n) \" \" msg)))))");
    L.push("(defun c:CSACHECK ( / ) (csa-ck-layer)");
    res.issues.forEach(function (i) {
      if (i.x == null || isNaN(i.x)) return;
      var col = i.sev === "error" ? 1 : i.sev === "warn" ? 2 : 4;
      L.push("  (csa-ck " + i.x.toFixed(2) + " " + i.y.toFixed(2) + " " + i.no + " \"" + esc(i.msg.slice(0, 90)) + "\" " + col + ")");
    });
    L.push("  (princ \"\\nCSA AI: da danh dau loi tren layer CSA_CHECK.\") (princ))");
    L.push("(defun c:CSACHECKCLEAR ( / ss) (if (setq ss (ssget \"_X\" '((8 . \"CSA_CHECK\")))) (command \"_.ERASE\" ss \"\")) (princ))");
    L.push("(princ \"\\nCSA AI: go CSACHECK de hien dau loi.\") (princ)");
    return L.join("\r\n");
  }

  var API = { check: check, toLisp: toLisp, detectN: detectN, OFFICIAL: OFFICIAL };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSACheck = API;
})(typeof window !== "undefined" ? window : this);
