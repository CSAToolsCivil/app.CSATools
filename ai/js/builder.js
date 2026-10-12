/* CSA AI – Dựng mặt bằng kết cấu (MBKC) từ mặt bằng kiến trúc DXF theo QUY TẮC VẼ KC
   Đầu ra: file LISP (lệnh CSA_MBKC) vẽ trực tiếp trong AutoCAD + báo cáo giả thiết/câu hỏi + dữ liệu preview */
(function (root) {
  "use strict";
  var D = (typeof module !== "undefined" && module.exports) ? require("./dxf.js") : root.CSADXF;

  var PAPER = { A3: [420, 297], A2: [594, 420], A1: [841, 594] };
  var LAYERS = [
    ["KCS-BETONG", 4, "Continuous", 1], ["KCS_AXIS", 8, "CENTER", 1], ["KCS_BORDER", 3, "Continuous", 1], ["KCS_DIM", 8, "Continuous", 1],
    ["KCS_HATCH", 251, "Continuous", 1], ["KCS_HIDDEN", 9, "HIDDEN", 1], ["KCS_KHONG_IN", 250, "Continuous", 0], ["KCS_MANH", 8, "Continuous", 1],
    ["KCS_STEEL", 4, "Continuous", 1], ["KCS_STEEL_BOTTOM", 4, "HIDDEN", 1], ["KCS_STIRRUP", 30, "Continuous", 1], ["KCS_TEXT", 60, "Continuous", 1],
    ["KCS_PLOTTER", 7, "Continuous", 1], ["KCS_TEXT_BANVE_TEN", 7, "Continuous", 1], ["KCS_TEXT_BANVE_SO", 7, "Continuous", 1]
  ];

  function layerSummary(dxf) {
    var ents = D.explode(dxf), m = {};
    ents.forEach(function (e) {
      var o = m[e.layer] = m[e.layer] || { name: e.layer, LINE: 0, PLINE: 0, CLOSED: 0, TEXT: 0, CIRCLE: 0, HATCH: 0, DIM: 0, total: 0, samples: [] };
      o.total++; if (o[e.type] !== undefined) o[e.type]++; if (e.type === "PLINE" && e.closed) o.CLOSED++;
      if (e.type === "TEXT" && o.samples.length < 4) o.samples.push(e.text);
    });
    var arr = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.total - a.total; });
    // gợi ý layer theo tên
    function guess(re) { return arr.filter(function (l) { return re.test(D.norm(l.name)); }).map(function (l) { return l.name; }); }
    return {
      layers: arr, ents: ents,
      guess: {
        axis: guess(/(axis|truc|grid|^a-anno-grid|center)/), axisText: guess(/(axis|truc|grid|bubble)/),
        col: guess(/(col|cot|column|kc-cot|s-col|concrete|betong)/), wall: guess(/(wall|tuong|a-wall)/), open: guess(/(open|lo mo|thang|stair|elev|hop ky thuat|shaft|void)/)
      }
    };
  }

  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  function build(dxf, opt) {
    var notes = [], ask = [];
    var ents = D.explode(dxf);
    var Ls = function (arr) { var s = {}; (arr || []).forEach(function (n) { s[n] = 1; }); return s; };
    var LA = Ls(opt.layers.axis), LAT = Ls(opt.layers.axisText.length ? opt.layers.axisText : opt.layers.axis), LC = Ls(opt.layers.col), LW = Ls(opt.layers.wall), LO = Ls(opt.layers.open);
    if (!opt.paper || !PAPER[opt.paper]) throw new Error("Chưa chọn khổ giấy (A3/A2/A1) – quy tắc yêu cầu chọn trước.");
    if (!(opt.slabT > 0)) throw new Error("Chưa nhập chiều dày sàn (120 mm chỉ là ví dụ, không phải mặc định).");
    var floor = opt.floor || 2, plaster = +opt.plaster || 0;

    // ---------- 1. TRỤC ----------
    var axLines = ents.filter(function (e) { return LA[e.layer] && e.type === "LINE" && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) > 1500; });
    function collect(vert) {
      var arr = [];
      axLines.forEach(function (l) {
        if (vert && Math.abs(l.x1 - l.x2) < 1) arr.push({ c: (l.x1 + l.x2) / 2, a: Math.min(l.y1, l.y2), b: Math.max(l.y1, l.y2) });
        if (!vert && Math.abs(l.y1 - l.y2) < 1) arr.push({ c: (l.y1 + l.y2) / 2, a: Math.min(l.x1, l.x2), b: Math.max(l.x1, l.x2) });
      });
      arr.sort(function (u, v) { return u.c - v.c; });
      var out = [];
      arr.forEach(function (o) { var L = out[out.length - 1]; if (L && Math.abs(o.c - L.c) < 5) { L.a = Math.min(L.a, o.a); L.b = Math.max(L.b, o.b); } else out.push({ c: o.c, a: o.a, b: o.b }); });
      return out;
    }
    var AX = collect(true), AY = collect(false); // AX: trục đứng (theo x) ; AY: trục ngang (theo y)
    if (AX.length < 1 || AY.length < 1) throw new Error("Không tìm thấy lưới trục trên layer đã chọn (cần LINE ngang và đứng).");
    var axTexts = ents.filter(function (e) { return e.type === "TEXT" && LAT[e.layer] && e.text.trim().length > 0 && e.text.trim().length <= 4; });
    function nameAxis(ax, vert) {
      var best = null, bd = Infinity;
      axTexts.forEach(function (t) {
        var off = vert ? Math.abs(t.x - ax.c) : Math.abs(t.y - ax.c);
        var along = vert ? t.y : t.x;
        if (off > 800) return;
        var out = along < ax.a ? ax.a - along : along > ax.b ? along - ax.b : -1;
        if (out < 0 && off > 50) return;
        var d = off + Math.max(out, 0) * 0.05;
        if (d < bd) { bd = d; best = t; }
      });
      return best ? best.text.trim().toUpperCase() : null;
    }
    AX.forEach(function (a, i) { a.name = nameAxis(a, true); if (!a.name) { a.name = String(i + 1); a.auto = true; } });
    AY.forEach(function (a, i) { a.name = nameAxis(a, false); if (!a.name) { a.name = String.fromCharCode(65 + AY.length - 1 - i); a.auto = true; } });
    if (AX.concat(AY).some(function (a) { return a.auto; })) ask.push("Một số trục không đọc được tên từ kiến trúc → đã đặt tạm (" + AX.concat(AY).filter(function (a) { return a.auto; }).map(function (a) { return a.name; }).join(", ") + "). Cần kiểm tra lại tên trục.");

    // ---------- 2. CỘT ----------
    var colRects = [];
    ents.forEach(function (e) {
      if (!LC[e.layer]) return;
      var pts = null;
      if (e.type === "PLINE" && e.closed && e.pts.length >= 4) pts = e.pts;
      else if (e.type === "HATCH" && e.pts.length >= 3) pts = e.pts;
      else if (e.type === "CIRCLE") pts = [{ x: e.x - e.r, y: e.y - e.r }, { x: e.x + e.r, y: e.y + e.r }];
      if (!pts) return;
      var b = D.bboxPts(pts), w = b.x2 - b.x1, h = b.y2 - b.y1;
      if (w < 100 || h < 100 || w > 3000 || h > 3000) return;
      colRects.push({ x1: b.x1 + plaster, y1: b.y1 + plaster, x2: b.x2 - plaster, y2: b.y2 - plaster, round: e.type === "CIRCLE", rect: e.type !== "PLINE" || D.isRect(e.pts, 2) });
    });
    // gộp trùng
    var COLS = [];
    colRects.sort(function (a, b) { return (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1); }).forEach(function (r) {
      var cx = (r.x1 + r.x2) / 2, cy = (r.y1 + r.y2) / 2;
      if (COLS.some(function (c) { return cx > c.x1 && cx < c.x2 && cy > c.y1 && cy < c.y2; })) return;
      r.cx = cx; r.cy = cy; r.w = r.x2 - r.x1; r.h = r.y2 - r.y1; COLS.push(r);
    });
    if (!COLS.length) throw new Error("Không tìm thấy cột trên layer đã chọn (cần polyline kín / hatch / circle).");
    if (COLS.some(function (c) { return !c.rect; })) ask.push("Có cột không phải hình chữ nhật – đã lấy theo khung bao, cần kiểm tra hình dạng thật.");

    // ---------- 3. TƯỜNG ----------
    var segs = [];
    ents.forEach(function (e) {
      if (!LW[e.layer]) return;
      var s = e.type === "LINE" ? [[e.x1, e.y1, e.x2, e.y2]] : e.type === "PLINE" ? e.pts.map(function (p, i) { var q = e.pts[(i + 1) % e.pts.length]; return (i < e.pts.length - 1 || e.closed) ? [p.x, p.y, q.x, q.y] : null; }).filter(Boolean) : [];
      s.forEach(function (k) {
        if (Math.hypot(k[2] - k[0], k[3] - k[1]) < 150) return;
        if (Math.abs(k[1] - k[3]) < 1) segs.push({ d: "X", c: k[1], a: Math.min(k[0], k[2]), b: Math.max(k[0], k[2]) });
        else if (Math.abs(k[0] - k[2]) < 1) segs.push({ d: "Y", c: k[0], a: Math.min(k[1], k[3]), b: Math.max(k[1], k[3]) });
      });
    });
    var tMin = opt.wallMin || 90, tMax = opt.wallMax || 300, WALLS = [];
    ["X", "Y"].forEach(function (d) {
      var S = segs.filter(function (s) { return s.d === d; }).sort(function (u, v) { return u.c - v.c; });
      for (var i = 0; i < S.length; i++) for (var j = i + 1; j < S.length; j++) {
        var t = S[j].c - S[i].c; if (t > tMax) break; if (t < tMin) continue;
        var a = Math.max(S[i].a, S[j].a), b = Math.min(S[i].b, S[j].b);
        if (b - a > 250) WALLS.push({ d: d, c: (S[i].c + S[j].c) / 2, a: a, b: b, t: t });
      }
    });
    WALLS = mergeColl(WALLS, 1500);

    // ---------- 4. LỖ MỞ ----------
    var OPENS = [];
    ents.forEach(function (e) {
      if (!LO[e.layer] || e.type !== "PLINE" || !e.closed) return;
      var b = D.bboxPts(e.pts), A = (b.x2 - b.x1) * (b.y2 - b.y1) / 1e6;
      if (A < 0.3) return;
      if (!D.isRect(e.pts, 5)) ask.push("Lỗ mở không chữ nhật tại (" + round(b.x1) + ", " + round(b.y1) + ") – đã lấy khung bao.");
      OPENS.push({ x1: b.x1 - plaster, y1: b.y1 - plaster, x2: b.x2 + plaster, y2: b.y2 + plaster, area: A });
    });
    OPENS = OPENS.filter(function (o, i) { return !OPENS.some(function (p, j) { return j < i && Math.abs(p.x1 - o.x1) < 5 && Math.abs(p.y1 - o.y1) < 5 && Math.abs(p.x2 - o.x2) < 5 && Math.abs(p.y2 - o.y2) < 5; }); });

    // ---------- 5. DẦM ----------
    var BEAMS = [];
    function colOnAxis(c, ax, vert) { return vert ? Math.abs(c.cx - ax.c) <= c.w / 2 + 50 : Math.abs(c.cy - ax.c) <= c.h / 2 + 50; }
    AX.forEach(function (ax) { // dầm phương Y trên trục đứng
      var cs = COLS.filter(function (c) { return colOnAxis(c, ax, true); }).sort(function (a, b) { return a.cy - b.cy; });
      for (var i = 0; i + 1 < cs.length; i++) BEAMS.push({ d: "Y", c: ax.c, a: cs[i].cy, b: cs[i + 1].cy, kind: "main", onAxis: ax.name });
    });
    AY.forEach(function (ax) {
      var cs = COLS.filter(function (c) { return colOnAxis(c, ax, false); }).sort(function (a, b) { return a.cx - b.cx; });
      for (var i = 0; i + 1 < cs.length; i++) BEAMS.push({ d: "X", c: ax.c, a: cs[i].cx, b: cs[i + 1].cx, kind: "main", onAxis: ax.name });
    });
    // dầm đỡ tường
    WALLS.forEach(function (w) {
      var parts = subtractCovered(w, BEAMS.filter(function (b) { return b.d === w.d && Math.abs(b.c - w.c) <= 0.5 * (220 + w.t) + 20; }));
      parts.forEach(function (p) { if (p.b - p.a < 600) return; BEAMS.push({ d: w.d, c: w.c, a: p.a, b: p.b, kind: "wall" }); });
    });
    // kéo dài dầm phụ tới gối gần nhất
    var widthGuess = 220;
    function extend(bm, exclude) {
      ["a", "b"].forEach(function (end) {
        var pos = bm[end], dirSign = end === "a" ? -1 : 1, best = null;
        BEAMS.forEach(function (o) {
          if (o === bm || o.d === bm.d || (exclude && exclude(o))) return;
          if (bm.c < o.a - 1 || bm.c > o.b + 1) return;
          var d = (o.c - pos) * dirSign;
          if (d >= -widthGuess && d <= 2500 && (!best || d < best.d)) best = { d: d, at: o.c };
        });
        COLS.forEach(function (c) {
          var inBand = bm.d === "X" ? (bm.c >= c.y1 - 1 && bm.c <= c.y2 + 1) : (bm.c >= c.x1 - 1 && bm.c <= c.x2 + 1);
          if (!inBand) return;
          var cc = bm.d === "X" ? c.cx : c.cy, half = bm.d === "X" ? c.w / 2 : c.h / 2;
          var d = (cc - pos) * dirSign;
          if (d >= -half - 1 && d <= 2500 && (!best || d < best.d)) best = { d: d, at: cc };
        });
        if (best) bm[end] = best.at; else bm["free_" + end] = true;
      });
      if (bm.a > bm.b) { var t = bm.a; bm.a = bm.b; bm.b = t; }
      if (bm.free_a || bm.free_b) ask.push("Dầm " + (bm.kind === "wall" ? "đỡ tường" : "bao lỗ mở") + " tại " + (bm.d === "X" ? "y" : "x") + "=" + round(bm.c) + " chưa tìm được gối ở " + (bm.free_a && bm.free_b ? "hai đầu" : "một đầu") + " – cần kiểm tra/bổ sung gối.");
    }
    BEAMS.filter(function (b) { return b.kind === "wall"; }).forEach(function (b) { extend(b); });
    // dầm bao lỗ mở > 2 m²: cặp cạnh dài gối vào kết cấu, cặp cạnh ngắn gối lên cặp cạnh dài
    OPENS.forEach(function (o, oi) {
      if (o.area <= 2) return;
      var longX = (o.x2 - o.x1) >= (o.y2 - o.y1);
      var eX = [{ d: "X", c: o.y1 - 110, e: o.y1 }, { d: "X", c: o.y2 + 110, e: o.y2 }], eY = [{ d: "Y", c: o.x1 - 110, e: o.x1 }, { d: "Y", c: o.x2 + 110, e: o.x2 }];
      var prim = longX ? eX : eY, sec = longX ? eY : eX;
      prim.forEach(function (ed) { if (ed.d === "X") { ed.a = o.x1; ed.b = o.x2; } else { ed.a = o.y1; ed.b = o.y2; } });
      sec.forEach(function (ed) { if (ed.d === "X") { ed.a = o.x1 - 110; ed.b = o.x2 + 110; } else { ed.a = o.y1 - 110; ed.b = o.y2 + 110; } });
      [prim, sec].forEach(function (grp, gi) {
        grp.forEach(function (ed) {
          var near = BEAMS.filter(function (b) { return b.d === ed.d && Math.abs(b.c - ed.e) < 400 && b.kind !== "open"; });
          if (near.some(function (b) { return b.a <= ed.a + 10 && b.b >= ed.b - 10; })) { if (gi === 0) { var nb = near.filter(function (b) { return b.a <= ed.a + 10 && b.b >= ed.b - 10; })[0]; ed.c = nb.c; } return; }
          var bm = { d: ed.d, c: ed.c, a: ed.a, b: ed.b, kind: "open", open: oi };
          BEAMS.push(bm);
          if (gi === 0) extend(bm, function (x) { return x.kind === "open" && x.open === oi; });
        });
        if (gi === 0) sec.forEach(function (ed) { if (ed.d === "X") { ed.a = prim[0].c; ed.b = prim[1].c; } else { ed.a = prim[0].c; ed.b = prim[1].c; } });
      });
    });
    BEAMS = dedupeBeams(BEAMS);

    // ---------- 6. GỐI & NHỊP ----------
    function supportsOf(bm) {
      var s = [bm.a, bm.b];
      COLS.forEach(function (c) {
        var inBand = bm.d === "X" ? (bm.c >= c.y1 - 1 && bm.c <= c.y2 + 1) : (bm.c >= c.x1 - 1 && bm.c <= c.x2 + 1);
        var cc = bm.d === "X" ? c.cx : c.cy;
        if (inBand && cc > bm.a + 1 && cc < bm.b - 1) s.push(cc);
      });
      BEAMS.forEach(function (o) {
        if (o.d === bm.d) return;
        if (bm.c >= o.a - 1 && bm.c <= o.b + 1 && o.c > bm.a + 1 && o.c < bm.b - 1) s.push(o.c);
      });
      s.sort(function (u, v) { return u - v; });
      return s.filter(function (v, i) { return i === 0 || v - s[i - 1] > 50; });
    }
    var SPANS = [];
    BEAMS.forEach(function (bm, bi) {
      var s = supportsOf(bm);
      for (var i = 0; i + 1 < s.length; i++) {
        var L = s[i + 1] - s[i], sec = section(L);
        if (sec.ask) ask.push("Nhịp dầm L = " + round(L / 1000, 2) + " m > 8.5 m tại " + (bm.d === "X" ? "y" : "x") + "=" + round(bm.c) + " – quy tắc yêu cầu hỏi kỹ sư chủ trì trước khi chọn tiết diện (đã đặt tạm " + sec.b + "×" + sec.h + ").");
        SPANS.push({ d: bm.d, c: bm.c, a: s[i], b: s[i + 1], L: L, bw: sec.b, h: sec.h, kind: bm.kind, beam: bi, onAxis: bm.onAxis });
      }
    });

    // ---------- 7. ĐẶT TÊN ----------
    var LINES = [];
    ["X", "Y"].forEach(function (d) {
      var S = SPANS.filter(function (s) { return s.d === d; }).sort(function (u, v) { return u.c - v.c || u.a - v.a; });
      var groups = [];
      S.forEach(function (s) { var g = groups[groups.length - 1]; if (g && Math.abs(g.c - s.c) < 5) g.spans.push(s); else groups.push({ d: d, c: s.c, spans: [s] }); });
      groups.forEach(function (g) {
        var chains = [];
        g.spans.forEach(function (s) { var ch = chains[chains.length - 1]; if (ch && Math.abs(ch[ch.length - 1].b - s.a) < 10) ch.push(s); else chains.push([s]); });
        chains.forEach(function (ch, k) { LINES.push({ d: d, c: g.c, spans: ch, a: ch[0].a, b: ch[ch.length - 1].b, part: chains.length > 1 ? String.fromCharCode(65 + k) : "" }); });
      });
    });
    var X = LINES.filter(function (l) { return l.d === "X"; }).sort(function (u, v) { return v.c - u.c || u.a - v.a; });
    var Y = LINES.filter(function (l) { return l.d === "Y"; }).sort(function (u, v) { return u.c - v.c || v.b - u.b; });
    [X, Y].forEach(function (arr) {
      var keys = {}, n = 0, groupNo = {};
      arr.forEach(function (ln) {
        var colSizes = ln.spans.map(function (s) { return supportCol(s.a, ln) + "/" + supportCol(s.b, ln); }).join(";");
        var key = ln.spans.map(function (s) { return s.bw + "x" + s.h + "@" + Math.round(s.L / 10); }).join("|") + "#" + colSizes;
        var gkey = ln.d + Math.round(ln.c);
        if (ln.part) {
          if (!groupNo[gkey]) { n++; groupNo[gkey] = n; }
          ln.no = groupNo[gkey]; ln.name = "D" + floor + "-" + ln.d + ln.no + ln.part; return;
        }
        if (keys[key]) { ln.name = keys[key]; return; }
        n++; ln.no = n; ln.name = "D" + floor + "-" + ln.d + n; keys[key] = ln.name;
      });
    });
    function supportCol(pos, ln) {
      var c = COLS.find(function (c) { var cc = ln.d === "X" ? c.cx : c.cy; var inB = ln.d === "X" ? (ln.c >= c.y1 - 1 && ln.c <= c.y2 + 1) : (ln.c >= c.x1 - 1 && ln.c <= c.x2 + 1); return inB && Math.abs(cc - pos) < 5; });
      return c ? Math.round(c.w) + "x" + Math.round(c.h) : "B";
    }

    // ---------- 8. CHỌN N, BỐ CỤC ----------
    var all = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    function grow(x1, y1, x2, y2) { all.x1 = Math.min(all.x1, x1); all.y1 = Math.min(all.y1, y1); all.x2 = Math.max(all.x2, x2); all.y2 = Math.max(all.y2, y2); }
    COLS.forEach(function (c) { grow(c.x1, c.y1, c.x2, c.y2); });
    SPANS.forEach(function (s) { if (s.d === "X") grow(s.a, s.c - s.bw / 2, s.b, s.c + s.bw / 2); else grow(s.c - s.bw / 2, s.a, s.c + s.bw / 2, s.b); });
    AX.forEach(function (a) { grow(a.c, all.y1, a.c, all.y1); }); AY.forEach(function (a) { grow(all.x1, a.c, all.x1, a.c); });
    var bld = { x1: all.x1, y1: all.y1, x2: all.x2, y2: all.y2 };
    var secBeamsY = SPANS.filter(function (s) { return s.d === "Y" && !AX.some(function (a) { return Math.abs(a.c - s.c) < 5; }); });
    var secBeamsX = SPANS.filter(function (s) { return s.d === "X" && !AY.some(function (a) { return Math.abs(a.c - s.c) < 5; }); });
    var innerRowsB = secRows(secBeamsY, AX), innerRowsL = secRows(secBeamsX, AY);
    function rowsTotal(nInner, nAxes) { return nInner + (nAxes > 2 ? 2 : 1); }
    var paper = PAPER[opt.paper], N = opt.N ? +opt.N : null;
    function extentFor(n) {
      var padB = (12 + 6 * (rowsTotal(innerRowsB.length, AX.length) - 1) + 5.2 + 3.2 + 4 + 12 + 10) * n; // + tiêu đề
      var padT = (12 + 6 * ((AX.length > 2 ? 2 : 1) - 1) + 5.2 + 3.2 + 4) * n;
      var padL = (12 + 6 * (rowsTotal(innerRowsL.length, AY.length) - 1) + 5.2 + 3.2 + 4) * n;
      var padR = (12 + 6 * ((AY.length > 2 ? 2 : 1) - 1) + 5.2 + 3.2 + 4) * n;
      return { w: bld.x2 - bld.x1 + padL + padR, h: bld.y2 - bld.y1 + padT + padB, padL: padL, padB: padB };
    }
    var contentW = paper[0] - 15 - 5 - 50, contentH = paper[1] - 10;
    if (!N) { N = 5; while (N < 1000) { var e = extentFor(N); if (e.w <= (contentW - 40) * N && e.h <= (contentH - 30) * N) break; N += 5; } }
    else { var ee = extentFor(N); if (ee.w > contentW * N || ee.h > contentH * N) notes.push("Tỷ lệ 1:" + N + " có thể không đủ chỗ trên khổ " + opt.paper + " – nên tăng N."); }
    notes.push("Tỷ lệ trình bày 1:" + N + " (N bội số của 5, khung " + opt.paper + " phóng " + N + " lần).");

    // ---------- 9. HÌNH HỌC ĐẦU RA ----------
    var G = { lines: [], plines: [], circles: [], texts: [], dims: [], hatchCols: [], N: N };
    function L(layer, x1, y1, x2, y2) { if (Math.hypot(x2 - x1, y2 - y1) > 0.5) G.lines.push({ layer: layer, x1: x1, y1: y1, x2: x2, y2: y2 }); }
    function T(layer, style, txt, x, y, hpaper, rot, extra) { G.texts.push(Object.assign({ layer: layer, style: style, text: txt, x: x, y: y, h: hpaper * N, rot: rot || 0 }, extra || {})); }

    // cột
    COLS.forEach(function (c) { G.plines.push({ layer: "KCS-BETONG", pts: [[c.x1, c.y1], [c.x2, c.y1], [c.x2, c.y2], [c.x1, c.y2]], col: true }); });
    // dầm: cạnh dài, cắt trong vùng giao, phân nét thấy/khuất
    var rects = SPANS.map(function (s) { return s.d === "X" ? { x1: s.a, x2: s.b, y1: s.c - s.bw / 2, y2: s.c + s.bw / 2, s: s } : { x1: s.c - s.bw / 2, x2: s.c + s.bw / 2, y1: s.a, y2: s.b, s: s }; });
    var colR = COLS.map(function (c) { return { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 }; });
    function covered(x, y) {
      if (OPENS.some(function (o) { return x > o.x1 && x < o.x2 && y > o.y1 && y < o.y2; })) return false;
      var R = rects.concat(colR);
      var hit = { l: 0, r: 0, u: 0, d: 0 };
      R.forEach(function (r) {
        if (y >= r.y1 && y <= r.y2) { if (r.x2 <= x) hit.l = 1; if (r.x1 >= x) hit.r = 1; }
        if (x >= r.x1 && x <= r.x2) { if (r.y2 <= y) hit.d = 1; if (r.y1 >= y) hit.u = 1; }
      });
      return hit.l && hit.r && hit.u && hit.d;
    }
    var edgePieces = [];
    rects.forEach(function (r, ri) {
      var s = r.s, sides = s.d === "X" ? [{ c: r.y1, out: -1 }, { c: r.y2, out: 1 }] : [{ c: r.x1, out: -1 }, { c: r.x2, out: 1 }];
      sides.forEach(function (sd) {
        var cuts = [];
        rects.forEach(function (o, oi) {
          if (oi === ri) return;
          if (s.d === "X" && sd.c > o.y1 + 0.5 && sd.c < o.y2 - 0.5) cuts.push([o.x1, o.x2]);
          if (s.d === "Y" && sd.c > o.x1 + 0.5 && sd.c < o.x2 - 0.5) cuts.push([o.y1, o.y2]);
        });
        var colCuts = [];
        colR.forEach(function (o) {
          if (s.d === "X" && sd.c > o.y1 + 0.5 && sd.c < o.y2 - 0.5) colCuts.push([o.x1, o.x2]);
          if (s.d === "Y" && sd.c > o.x1 + 0.5 && sd.c < o.x2 - 0.5) colCuts.push([o.y1, o.y2]);
        });
        var pieces = subIntervals([s.a, s.b], cuts.concat(colCuts));
        pieces.forEach(function (p) {
          var mid = (p[0] + p[1]) / 2, px = s.d === "X" ? mid : sd.c + sd.out * 30, py = s.d === "X" ? sd.c + sd.out * 30 : mid;
          var vis = !covered(px, py);
          edgePieces.push({ d: s.d, c: sd.c, a: p[0], b: p[1], vis: vis });
        });
      });
    });
    // nối nét thấy thẳng hàng qua cột; gộp trùng
    ["X", "Y"].forEach(function (d) {
      [true, false].forEach(function (vis) {
        var P = edgePieces.filter(function (p) { return p.d === d && p.vis === vis; }).sort(function (u, v) { return u.c - v.c || u.a - v.a; });
        var out = [];
        P.forEach(function (p) {
          var q = out[out.length - 1];
          if (q && Math.abs(q.c - p.c) < 0.5) {
            var gap = p.a - q.b;
            var throughCol = vis && gap > 0 && colR.some(function (o) { return d === "X" ? (p.c >= o.y1 - 0.5 && p.c <= o.y2 + 0.5 && o.x1 <= q.b + 0.5 && o.x2 >= p.a - 0.5) : (p.c >= o.x1 - 0.5 && p.c <= o.x2 + 0.5 && o.y1 <= q.b + 0.5 && o.y2 >= p.a - 0.5); });
            if (gap <= 0.5 || throughCol) { q.b = Math.max(q.b, p.b); return; }
          }
          out.push({ c: p.c, a: p.a, b: p.b });
        });
        out.forEach(function (o) { if (d === "X") L(vis ? "KCS_BORDER" : "KCS_HIDDEN", o.a, o.c, o.b, o.c); else L(vis ? "KCS_BORDER" : "KCS_HIDDEN", o.c, o.a, o.c, o.b); });
      });
    });
    // lỗ mở
    OPENS.forEach(function (o) {
      G.plines.push({ layer: "KCS_BORDER", pts: [[o.x1, o.y1], [o.x2, o.y1], [o.x2, o.y2], [o.x1, o.y2]] });
      L("KCS_MANH", o.x1, o.y1, o.x2, o.y2); L("KCS_MANH", o.x1, o.y2, o.x2, o.y1);
    });
    if (COLS.length && opt.hatchCols !== false) G.hatchCols = true;

    // nhãn dầm
    var labelBoxes = [];
    LINES.forEach(function (ln) {
      var runs = [];
      ln.spans.forEach(function (s) { var r = runs[runs.length - 1]; if (r && r.bw === s.bw && r.h === s.h) r.spans.push(s); else runs.push({ bw: s.bw, h: s.h, spans: [s] }); });
      runs.forEach(function (r) {
        var sp = r.spans.slice().sort(function (u, v) { return v.L - u.L; })[0];
        var txt = ln.name + " (" + (r.bw / 10) + "X" + (r.h / 10) + ")", h = 2.2 * N, w = D.textWidth(txt) * h * 0.7;
        var tries = [0.5, 0.3, 0.7, 0.2, 0.8], placed = null;
        for (var k = 0; k < tries.length && !placed; k++) {
          var m = sp.a + (sp.b - sp.a) * tries[k];
          var x, y, rot, box;
          if (ln.d === "X") { x = m; y = ln.c + r.bw / 2 + 1 * N + h / 2; rot = 0; box = { x1: x - w / 2, x2: x + w / 2, y1: y - h / 2, y2: y + h / 2 }; }
          else { x = ln.c - r.bw / 2 - 1 * N - h / 2; y = m; rot = 90; box = { x1: x - h / 2, x2: x + h / 2, y1: y - w / 2, y2: y + w / 2 }; }
          if (!labelBoxes.some(function (b) { return D.boxOverlap(b, box, 0); }) || k === tries.length - 1) placed = { x: x, y: y, rot: rot, box: box };
        }
        labelBoxes.push(placed.box);
        T("KCS_TEXT", "ARIAL-0.7", txt, placed.x, placed.y, 2.2, placed.rot, { mc: true });
      });
    });

    // ---------- 10. TRỤC + DIM ----------
    var rowGap = 6 * N, first = 12 * N;
    var nb = rowsTotal(innerRowsB.length, AX.length), nt = AX.length > 2 ? 2 : 1, nl = rowsTotal(innerRowsL.length, AY.length), nr = AY.length > 2 ? 2 : 1;
    var yB = function (i) { return bld.y1 - first - i * rowGap; }, yT = function (i) { return bld.y2 + first + i * rowGap; };
    var xL = function (i) { return bld.x1 - first - i * rowGap; }, xR = function (i) { return bld.x2 + first + i * rowGap; };
    var bubB = yB(nb - 1) - 5.2 * N, bubT = yT(nt - 1) + 5.2 * N, bubL = xL(nl - 1) - 5.2 * N, bubR = xR(nr - 1) + 5.2 * N, R = 3.2 * N;
    AX.forEach(function (a) {
      L("KCS_AXIS", a.c, bubB + R, a.c, bubT - R);
      [bubB, bubT].forEach(function (y) { G.circles.push({ layer: "KCS_MANH", x: a.c, y: y, r: R }); T("KCS_AXIS", "ARIAL-0.7", a.name, a.c, y, 3.2, 0, { mc: true }); });
    });
    AY.forEach(function (a) {
      L("KCS_AXIS", bubL + R, a.c, bubR - R, a.c);
      [bubL, bubR].forEach(function (x) { G.circles.push({ layer: "KCS_MANH", x: x, y: a.c, r: R }); T("KCS_AXIS", "ARIAL-0.7", a.name, x, a.c, 3.2, 0, { mc: true }); });
    });
    function dimRowH(axes, y, yRef) { for (var i = 0; i + 1 < axes.length; i++) G.dims.push({ h: true, x1: axes[i].c, y1: yRef, x2: axes[i + 1].c, y2: yRef, at: y }); }
    function dimRowV(axes, x, xRef) { for (var i = 0; i + 1 < axes.length; i++) G.dims.push({ h: false, x1: xRef, y1: axes[i].c, x2: xRef, y2: axes[i + 1].c, at: x }); }
    // dưới: trong cùng dầm phụ, giữa trục-trục, ngoài tổng
    innerRowsB.forEach(function (row, i) { row.forEach(function (it) { G.dims.push({ h: true, x1: it.ax1, y1: bld.y1, x2: it.edge, y2: bld.y1, at: yB(i) }); G.dims.push({ h: true, x1: it.edge, y1: bld.y1, x2: it.ax2, y2: bld.y1, at: yB(i) }); }); });
    var ib = innerRowsB.length;
    dimRowH(AX, yB(ib), bld.y1); if (AX.length > 2) G.dims.push({ h: true, x1: AX[0].c, y1: bld.y1, x2: AX[AX.length - 1].c, y2: bld.y1, at: yB(ib + 1) });
    dimRowH(AX, yT(0), bld.y2); if (AX.length > 2) G.dims.push({ h: true, x1: AX[0].c, y1: bld.y2, x2: AX[AX.length - 1].c, y2: bld.y2, at: yT(1) });
    innerRowsL.forEach(function (row, i) { row.forEach(function (it) { G.dims.push({ h: false, x1: bld.x1, y1: it.ax1, x2: bld.x1, y2: it.edge, at: xL(i) }); G.dims.push({ h: false, x1: bld.x1, y1: it.edge, x2: bld.x1, y2: it.ax2, at: xL(i) }); }); });
    var il = innerRowsL.length;
    dimRowV(AY, xL(il), bld.x1); if (AY.length > 2) G.dims.push({ h: false, x1: bld.x1, y1: AY[0].c, x2: bld.x1, y2: AY[AY.length - 1].c, at: xL(il + 1) });
    dimRowV(AY, xR(0), bld.x2); if (AY.length > 2) G.dims.push({ h: false, x1: bld.x2, y1: AY[0].c, x2: bld.x2, y2: AY[AY.length - 1].c, at: xR(1) });

    // ---------- 11. KÝ HIỆU SÀN ----------
    var elev = opt.elevIsStructural ? +opt.finishElev : (+opt.finishElev - 0.05);
    var elevTxt = (elev >= 0 ? "+" : "-") + Math.abs(elev).toFixed(3), thTxt = Math.round(opt.slabT) + "MM";
    var cells = [];
    for (var i = 0; i + 1 < AX.length; i++) for (var j = 0; j + 1 < AY.length; j++) {
      var cx = (AX[i].c + AX[i + 1].c) / 2, cy = (AY[j].c + AY[j + 1].c) / 2;
      if (!covered(cx, cy)) continue;
      cells.push({ x: cx, y: cy, a: (AX[i + 1].c - AX[i].c) * (AY[j + 1].c - AY[j].c) });
    }
    cells.sort(function (u, v) { return v.a - u.a; });
    var mid = { x: (bld.x1 + bld.x2) / 2, y: (bld.y1 + bld.y2) / 2 };
    var cpick = cells.length ? cells.slice(0, 3).sort(function (u, v) { return Math.hypot(u.x - mid.x, u.y - mid.y) - Math.hypot(v.x - mid.x, v.y - mid.y); })[0] : mid;
    var sw = Math.max(D.textWidth(elevTxt), D.textWidth(thTxt)) * 2.2 * 0.7 * N + 2 * N, bh = (2.2 + 2) * N;
    G.plines.push({ layer: "KCS_MANH", pts: [[cpick.x - sw / 2, cpick.y], [cpick.x + sw / 2, cpick.y], [cpick.x + sw / 2, cpick.y + bh], [cpick.x - sw / 2, cpick.y + bh]] });
    G.plines.push({ layer: "KCS_MANH", pts: [[cpick.x - sw / 2, cpick.y - bh], [cpick.x + sw / 2, cpick.y - bh], [cpick.x + sw / 2, cpick.y], [cpick.x - sw / 2, cpick.y]] });
    T("KCS_TEXT", "ARIAL-0.7", elevTxt, cpick.x, cpick.y + bh / 2, 2.2, 0, { mc: true });
    T("KCS_TEXT", "ARIAL-0.7", thTxt, cpick.x, cpick.y - bh / 2, 2.2, 0, { mc: true });

    // ---------- 12. TIÊU ĐỀ, CHÚ GIẢI, KHUNG ----------
    var title = (opt.title || ("MẶT BẰNG KẾT CẤU SÀN TẦNG " + floor)).toUpperCase();
    var tY = bubB - R - 12 * N;
    T("KCS_TEXT", "arial-bold-1.0", title, (bld.x1 + bld.x2) / 2, tY, 4.5, 0, { mc: true, underline: true });
    // khung giấy: căn giữa vùng nội dung
    var ext = { x1: bubL - R - 4 * N, x2: bubR + R + 4 * N, y1: tY - 6 * N, y2: bubT + R + 4 * N };
    var cw = contentW * N, ch = contentH * N;
    var fx = (ext.x1 + ext.x2) / 2 - cw / 2 - 15 * N, fy = (ext.y1 + ext.y2) / 2 - ch / 2 - 5 * N;
    G.frame = { x: fx, y: fy, N: N, paper: opt.paper, W: paper[0], H: paper[1] };
    L("KCS_PLOTTER", fx, fy, fx + paper[0] * N, fy + paper[1] * N);
    var stripX = fx + (paper[0] - 5 - 50) * N;
    T("KCS_TEXT_BANVE_TEN", "ARIAL-0.7", title, stripX + 25 * N, fy + 40 * N, 2.2, 0, { mc: true });
    T("KCS_TEXT_BANVE_SO", "ARIAL-0.7", opt.sheetNo || "KC-1", stripX + 25 * N, fy + 15 * N, 3.2, 0, { mc: true });
    // chú giải góc dưới trái
    var gx = fx + 22 * N, gy = fy + 14 * N;
    T("KCS_TEXT", "ARIAL-0.7", "CHÚ GIẢI SÀN", gx, gy + 22 * N, 2.2, 0, {});
    G.plines.push({ layer: "KCS_MANH", pts: [[gx, gy + 12 * N], [gx + 12 * N, gy + 12 * N], [gx + 12 * N, gy + 19 * N], [gx, gy + 19 * N]] });
    T("KCS_TEXT", "ARIAL-0.7", "SÀN DÀY " + thTxt + ", CAO ĐỘ " + elevTxt, gx + 15 * N, gy + 14.5 * N, 2.2, 0, {});
    if (OPENS.length) {
      G.plines.push({ layer: "KCS_BORDER", pts: [[gx, gy], [gx + 12 * N, gy], [gx + 12 * N, gy + 7 * N], [gx, gy + 7 * N]] });
      L("KCS_MANH", gx, gy, gx + 12 * N, gy + 7 * N); L("KCS_MANH", gx, gy + 7 * N, gx + 12 * N, gy);
      T("KCS_TEXT", "ARIAL-0.7", "KÝ HIỆU LỖ MỞ", gx + 15 * N, gy + 2.5 * N, 2.2, 0, {});
    }

    // ---------- báo cáo ----------
    var cnt = { cols: COLS.length, walls: WALLS.length, opens: OPENS.length, beams: SPANS.length, lines: LINES.length, axX: AX.length, axY: AY.length };
    notes.push("Kế thừa " + AX.length + " trục đứng (" + AX.map(function (a) { return a.name; }).join(", ") + ") và " + AY.length + " trục ngang (" + AY.map(function (a) { return a.name; }).join(", ") + ").");
    notes.push("Cột: " + COLS.length + " (giữ nguyên kích thước & vị trí kiến trúc" + (plaster ? ", đã trừ lớp trát " + plaster + " mm/phía" : ", không hiệu chỉnh lớp trát") + ").");
    notes.push("Tường nhận diện: " + WALLS.length + " đoạn → dầm đỡ tường; lỗ mở: " + OPENS.length + " (lỗ > 2 m² có dầm bao).");
    notes.push("Dầm: " + LINES.length + " tuyến / " + SPANS.length + " nhịp. Tiết diện sơ bộ theo quy tắc (h = max(400, 50·⌊L/600⌋); b = 220 khi L ≤ 7.5 m, 300 khi 7.5–8.5 m) – không thay tính toán chịu lực.");
    notes.push("Cao độ mặt sàn kết cấu " + elevTxt + (opt.elevIsStructural ? " (nhập trực tiếp)" : " = hoàn thiện " + (+opt.finishElev).toFixed(3) + " − 0.050") + "; chiều dày " + thTxt + ".");
    ask.push("Sàn WC/ban công hạ cốt, ô thang (biên dầm chiếu tới), phần nhô/giật cấp: tool chưa tự xét – cần đọc mặt cắt và bổ sung.");
    ask.push("Khung tên: đã dùng khung tạm theo kích thước chuẩn; 3 layer KCS_PLOTTER / KCS_TEXT_BANVE_TEN / KCS_TEXT_BANVE_SO đặt màu 7 tạm – cần kế thừa mẫu khung tên kiến trúc.");
    ask.push("Ký hiệu hai đầu DIM chưa được chốt trong quy tắc – đang để mặc định của AutoCAD.");
    return { G: G, N: N, notes: notes, ask: ask, count: cnt, axes: { X: AX, Y: AY }, cols: COLS, walls: WALLS, opens: OPENS, spans: SPANS, lines: LINES, bld: bld, elev: elevTxt };
  }

  // ---------- helpers ----------
  function section(L) {
    var h = Math.max(400, 50 * Math.floor(L / 600));
    if (L <= 7500) return { b: 220, h: h };
    if (L <= 8500) return { b: 300, h: h };
    return { b: 300, h: h, ask: true };
  }
  function mergeColl(arr, gapMax) {
    var out = [];
    ["X", "Y"].forEach(function (d) {
      var S = arr.filter(function (w) { return w.d === d; }).sort(function (u, v) { return u.c - v.c || u.a - v.a; });
      S.forEach(function (w) {
        var q = null;
        for (var i = out.length - 1; i >= 0; i--) { var o = out[i]; if (o.d === d && Math.abs(o.c - w.c) < 20 && w.a - o.b <= gapMax && w.b >= o.a - gapMax) { q = o; break; } }
        if (q) { q.a = Math.min(q.a, w.a); q.b = Math.max(q.b, w.b); q.t = Math.max(q.t, w.t); } else out.push(Object.assign({}, w));
      });
    });
    return out;
  }
  function subtractCovered(seg, covers) {
    var parts = [{ a: seg.a, b: seg.b }];
    covers.forEach(function (c) {
      var n = [];
      parts.forEach(function (p) {
        if (c.b <= p.a || c.a >= p.b) { n.push(p); return; }
        if (c.a > p.a) n.push({ a: p.a, b: c.a });
        if (c.b < p.b) n.push({ a: c.b, b: p.b });
      });
      parts = n;
    });
    return parts;
  }
  function subIntervals(seg, cuts) {
    var parts = [[seg[0], seg[1]]];
    cuts.forEach(function (c) {
      var n = [];
      parts.forEach(function (p) {
        if (c[1] <= p[0] + 0.5 || c[0] >= p[1] - 0.5) { n.push(p); return; }
        if (c[0] > p[0] + 0.5) n.push([p[0], c[0]]);
        if (c[1] < p[1] - 0.5) n.push([c[1], p[1]]);
      });
      parts = n;
    });
    return parts.filter(function (p) { return p[1] - p[0] > 1; });
  }
  function dedupeBeams(B) {
    var out = [];
    B.forEach(function (b) {
      if (b.b - b.a < 100) return;
      var dup = out.find(function (o) { return o.d === b.d && Math.abs(o.c - b.c) < 50 && Math.min(o.b, b.b) - Math.max(o.a, b.a) > 0.8 * (b.b - b.a); });
      if (dup) { dup.a = Math.min(dup.a, b.a); dup.b = Math.max(dup.b, b.b); return; }
      out.push(b);
    });
    return out;
  }
  function secRows(secSpans, axes) {
    // mỗi dầm phụ: trục trước → 1 mép (mép bé) → trục sau ; nhiều dầm trong 1 nhịp → nhiều hàng
    var uniq = [];
    secSpans.forEach(function (s) { if (!uniq.some(function (u) { return Math.abs(u.c - s.c) < 5; })) uniq.push(s); });
    var bySpan = {};
    uniq.forEach(function (s) {
      var i = -1; for (var k = 0; k + 1 < axes.length; k++) if (s.c > axes[k].c && s.c < axes[k + 1].c) i = k;
      if (i < 0) return;
      (bySpan[i] = bySpan[i] || []).push({ ax1: axes[i].c, ax2: axes[i + 1].c, edge: s.c - s.bw / 2 });
    });
    var rows = [];
    Object.keys(bySpan).forEach(function (k) { bySpan[k].sort(function (a, b) { return a.edge - b.edge; }).forEach(function (it, j) { (rows[j] = rows[j] || []).push(it); }); });
    return rows;
  }

  // ---------- LISP ----------
  function lispStr(s) {
    return "\"" + String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[^\x20-\x7e]/g, function (ch) { return "\\\\U+" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"); }) + "\"";
  }
  function f(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }
  function toLisp(res) {
    var G = res.G, N = res.N, out = [];
    function w(s) { out.push(s); }
    w(";; ============================================================");
    w(";; CSA AI - Dung MBKC tu mat bang kien truc. Lenh: CSA_MBKC");
    w(";; Ve bang AutoCAD that (layer, text style, dimstyle 2.2-" + N + ", LTSCALE " + (10 * N) + ").");
    w(";; ============================================================");
    w("(defun csa:lay (nm col lt plot / el)");
    w("  (if (not (tblsearch \"LTYPE\" lt)) (if (findfile \"acad.lin\") (command \"_.-LINETYPE\" \"_L\" lt \"acad.lin\" \"\")))");
    w("  (if (not (tblsearch \"LTYPE\" lt)) (setq lt \"Continuous\"))");
    w("  (if (not (tblsearch \"LAYER\" nm))");
    w("    (entmake (list '(0 . \"LAYER\") '(100 . \"AcDbSymbolTableRecord\") '(100 . \"AcDbLayerTableRecord\") (cons 2 nm) '(70 . 0) (cons 62 col) (cons 6 lt) (cons 290 plot) '(370 . -3)))");
    w("    (progn (setq el (entget (tblobjname \"LAYER\" nm))) (foreach pr (list (cons 62 col) (cons 6 lt) (cons 290 plot) (cons 70 0) (cons 370 -3))");
    w("      (setq el (if (assoc (car pr) el) (subst pr (assoc (car pr) el) el) (append el (list pr))))) (entmod el))))");
    w("(defun csa:sty (nm font wf)");
    w("  (if (not (tblsearch \"STYLE\" nm))");
    w("    (entmake (list '(0 . \"STYLE\") '(100 . \"AcDbSymbolTableRecord\") '(100 . \"AcDbTextStyleTableRecord\") (cons 2 nm) '(70 . 0) '(40 . 0.0) (cons 41 wf) '(50 . 0.0) '(71 . 0) '(42 . 2.5) (cons 3 font) '(4 . \"\")))))");
    w("(defun csa:L (ly x1 y1 x2 y2) (entmake (list '(0 . \"LINE\") (cons 8 ly) '(62 . 256) '(6 . \"ByLayer\") '(48 . 1.0) (list 10 x1 y1 0.0) (list 11 x2 y2 0.0))))");
    w("(defun csa:C (ly x y r) (entmake (list '(0 . \"CIRCLE\") (cons 8 ly) '(62 . 256) (list 10 x y 0.0) (cons 40 r))))");
    w("(defun csa:P (ly pts / l) (setq l (list '(0 . \"LWPOLYLINE\") '(100 . \"AcDbEntity\") (cons 8 ly) '(62 . 256) '(100 . \"AcDbPolyline\") (cons 90 (length pts)) '(70 . 1)))");
    w("  (foreach p pts (setq l (append l (list (list 10 (car p) (cadr p)))))) (entmake l) (entlast))");
    w("(defun csa:T (ly st txt x y h rot mc)");
    w("  (entmake (append (list '(0 . \"TEXT\") (cons 8 ly) '(62 . 256) (cons 7 st) (list 10 x y 0.0) (cons 40 h) (cons 1 txt) (cons 50 (* pi (/ rot 180.0))) (cons 41 (cdr (assoc 41 (tblsearch \"STYLE\" st)))))");
    w("    (if mc (list '(72 . 1) (list 11 x y 0.0) '(73 . 2)) nil))))");
    w("(defun csa:DH (x1 y1 x2 y2 yy) (command \"_.DIMLINEAR\" (list x1 y1) (list x2 y2) \"_H\" (list (/ (+ x1 x2) 2.0) yy)))");
    w("(defun csa:DV (x1 y1 x2 y2 xx) (command \"_.DIMLINEAR\" (list x1 y1) (list x2 y2) \"_V\" (list xx (/ (+ y1 y2) 2.0))))");
    w("(defun c:CSA_MBKC ( / oldos oldce oldcl oldds oldfd col)");
    w("  (setq oldos (getvar \"OSMODE\") oldce (getvar \"CMDECHO\") oldcl (getvar \"CLAYER\") oldds (getvar \"DIMSTYLE\") oldfd (getvar \"FILEDIA\"))");
    w("  (setvar \"CMDECHO\" 0) (setvar \"OSMODE\" 0) (setvar \"FILEDIA\" 0) (command \"_.UNDO\" \"_BE\")");
    LAYERS.forEach(function (l) { w("  (csa:lay " + lispStr(l[0]) + " " + l[1] + " " + lispStr(l[2]) + " " + l[3] + ")"); });
    w("  (csa:sty \"ARIAL-0.7\" \"arial.ttf\" 0.7) (csa:sty \"ARIAL-BOLD-0.7\" \"arialbd.ttf\" 0.7) (csa:sty \"arial-bold-1.0\" \"arialbd.ttf\" 1.0)");
    w("  (setvar \"LTSCALE\" " + (10 * N) + ".0) (setvar \"CELTSCALE\" 1.0) (setvar \"PSLTSCALE\" 1)");
    // dimstyle
    w("  (setvar \"DIMSCALE\" " + N + ".0) (setvar \"DIMTXT\" 2.2) (setvar \"DIMLFAC\" 1.0) (setvar \"DIMCLRT\" 60) (setvar \"DIMCLRD\" 8) (setvar \"DIMCLRE\" 8)");
    w("  (setvar \"DIMLWD\" -2) (setvar \"DIMLWE\" -2) (setvar \"DIMGAP\" 1.0) (setvar \"DIMDLE\" 1.0) (setvar \"DIMDLI\" 6.0) (setvar \"DIMEXE\" 1.0) (setvar \"DIMEXO\" 1.0)");
    w("  (if (getvar \"DIMFXLON\") (progn (setvar \"DIMFXLON\" 1) (setvar \"DIMFXL\" 6.0)))");
    w("  (setvar \"DIMASZ\" 1.0) (setvar \"DIMDEC\" 0) (setvar \"DIMRND\" 0.0) (setvar \"DIMLUNIT\" 2) (setvar \"DIMALT\" 0) (setvar \"DIMTOL\" 0) (setvar \"DIMPOST\" \"\")");
    w("  (setvar \"DIMTAD\" 1) (setvar \"DIMJUST\" 0) (setvar \"DIMTIH\" 0) (setvar \"DIMTOH\" 0) (setvar \"DIMTXSTY\" \"ARIAL-0.7\") (setvar \"DIMZIN\" 8)");
    w("  (if (tblsearch \"DIMSTYLE\" \"2.2-" + N + "\") (command \"_.-DIMSTYLE\" \"_S\" \"2.2-" + N + "\" \"_Y\") (command \"_.-DIMSTYLE\" \"_S\" \"2.2-" + N + "\"))");
    // geometry
    G.plines.forEach(function (p) {
      var s = "(" + p.pts.map(function (q) { return "(" + f(q[0]) + " " + f(q[1]) + ")"; }).join(" ") + ")";
      if (p.col && G.hatchCols) {
        w("  (setq col (csa:P " + lispStr(p.layer) + " '" + s + "))");
        w("  (setvar \"CLAYER\" \"KCS_HATCH\") (command \"_.-HATCH\" \"_P\" \"ANSI31\" " + (N * 0.5) + " 0 \"_S\" col \"\" \"\")");
      } else w("  (csa:P " + lispStr(p.layer) + " '" + s + ")");
    });
    G.lines.forEach(function (l) { w("  (csa:L " + lispStr(l.layer) + " " + f(l.x1) + " " + f(l.y1) + " " + f(l.x2) + " " + f(l.y2) + ")"); });
    G.circles.forEach(function (c) { w("  (csa:C " + lispStr(c.layer) + " " + f(c.x) + " " + f(c.y) + " " + f(c.r) + ")"); });
    G.texts.forEach(function (t) { w("  (csa:T " + lispStr(t.layer) + " " + lispStr(t.style) + " " + lispStr((t.underline ? "%%U" : "") + t.text) + " " + f(t.x) + " " + f(t.y) + " " + f(t.h) + " " + t.rot + " " + (t.mc ? "T" : "nil") + ")"); });
    w("  (setvar \"CLAYER\" \"KCS_DIM\")");
    G.dims.forEach(function (d) {
      if (Math.abs((d.h ? d.x2 - d.x1 : d.y2 - d.y1)) < 1) return;
      if (d.h) w("  (csa:DH " + f(d.x1) + " " + f(d.y1) + " " + f(d.x2) + " " + f(d.y2) + " " + f(d.at) + ")");
      else w("  (csa:DV " + f(d.x1) + " " + f(d.y1) + " " + f(d.x2) + " " + f(d.y2) + " " + f(d.at) + ")");
    });
    // khung: block chung
    var F = G.frame, P = PAPER[F.paper];
    var bn = "CSA_KHUNG_" + F.paper;
    w("  (if (not (tblsearch \"BLOCK\" " + lispStr(bn) + ")) (progn");
    w("    (entmake (list '(0 . \"BLOCK\") (cons 2 " + lispStr(bn) + ") '(70 . 0) '(10 0.0 0.0 0.0)))");
    function bl(ly, x1, y1, x2, y2) { w("    (entmake (list '(0 . \"LINE\") '(8 . " + lispStr(ly) + ") '(62 . 0) (list 10 " + x1 + " " + y1 + " 0.0) (list 11 " + x2 + " " + y2 + " 0.0)))"); }
    bl("0", 0, 0, P[0], 0); bl("0", P[0], 0, P[0], P[1]); bl("0", P[0], P[1], 0, P[1]); bl("0", 0, P[1], 0, 0);
    bl("0", 15, 5, P[0] - 5, 5); bl("0", P[0] - 5, 5, P[0] - 5, P[1] - 5); bl("0", P[0] - 5, P[1] - 5, 15, P[1] - 5); bl("0", 15, P[1] - 5, 15, 5);
    bl("0", P[0] - 55, 5, P[0] - 55, P[1] - 5); bl("0", P[0] - 55, 30, P[0] - 5, 30); bl("0", P[0] - 55, 55, P[0] - 5, 55);
    w("    (entmake '((0 . \"ENDBLK\")))))");
    w("  (entmake (list '(0 . \"INSERT\") '(8 . \"KCS_MANH\") (cons 2 " + lispStr(bn) + ") (list 10 " + f(F.x) + " " + f(F.y) + " 0.0) (cons 41 " + N + ".0) (cons 42 " + N + ".0) (cons 43 " + N + ".0)))");
    w("  (command \"_.UNDO\" \"_E\") (command \"_.REGENALL\")");
    w("  (setvar \"CLAYER\" oldcl) (setvar \"OSMODE\" oldos) (setvar \"FILEDIA\" oldfd) (setvar \"CMDECHO\" oldce)");
    w("  (princ \"\\nCSA AI: Da dung xong MBKC ty le 1:" + N + ". Kiem tra lai bao cao gia thiet truoc khi phat hanh.\") (princ))");
    w("(princ \"\\nCSA AI: go CSA_MBKC de ve mat bang ket cau.\") (princ)");
    return out.join("\r\n");
  }

  var API = { build: build, toLisp: toLisp, layerSummary: layerSummary, section: section, PAPER: PAPER };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSABuild = API;
})(typeof window !== "undefined" ? window : this);
