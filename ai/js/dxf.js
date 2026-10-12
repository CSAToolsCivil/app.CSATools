/* CSA AI – DXF reader + geometry helpers (browser & node) */
(function (root) {
  "use strict";

  // ---------- text helpers ----------
  function decodeU(s) {
    return String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
  }
  function cleanMText(s) {
    s = decodeU(s);
    s = s.replace(/\\P/g, "\n").replace(/\\[ACcFfHhQTWp][^;]*;/g, "").replace(/\\[LlOoKk]/g, "")
         .replace(/\\S([^;]*);/g, "$1").replace(/[{}]/g, "").replace(/\\~/g, " ").replace(/\\\\/g, "\\");
    return s;
  }
  function stripCodes(s) { // %%u, %%c...
    return String(s).replace(/%%[uUoOkK]/g, "").replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±");
  }

  // ---------- parser ----------
  function parse(text) {
    var lines = text.split(/\r?\n/);
    var pairs = [];
    for (var i = 0; i + 1 < lines.length; i += 2) {
      var c = parseInt(lines[i].trim(), 10);
      if (isNaN(c)) { i -= 1; continue; }
      pairs.push([c, lines[i + 1].replace(/\s+$/, "")]);
    }
    var dxf = { header: {}, layers: {}, styles: {}, dimstyles: {}, ltypes: {}, blocks: {}, entities: [], version: "" };
    var p = 0, n = pairs.length;
    function cur() { return pairs[p]; }
    while (p < n) {
      if (pairs[p][0] === 0 && pairs[p][1] === "SECTION") {
        var name = pairs[p + 1][1]; p += 2;
        if (name === "HEADER") p = readHeader(p);
        else if (name === "TABLES") p = readTables(p);
        else if (name === "BLOCKS") p = readBlocks(p);
        else if (name === "ENTITIES") { var r = readEntities(p, "ENDSEC"); dxf.entities = r.list; p = r.p; }
        else { while (p < n && !(pairs[p][0] === 0 && pairs[p][1] === "ENDSEC")) p++; }
      }
      p++;
    }
    dxf.version = dxf.header.$ACADVER ? dxf.header.$ACADVER[1] : "";
    return dxf;

    function readHeader(q) {
      var v = null;
      while (q < n && !(pairs[q][0] === 0 && pairs[q][1] === "ENDSEC")) {
        if (pairs[q][0] === 9) { v = pairs[q][1]; dxf.header[v] = {}; }
        else if (v) dxf.header[v][pairs[q][0]] = pairs[q][1];
        q++;
      }
      return q;
    }
    function readTables(q) {
      var table = null, rec = null;
      function flush() {
        if (!rec) return;
        var nm = rec[2];
        if (table === "LAYER" && nm != null) dxf.layers[nm] = { name: nm, color: num(rec[62], 7), linetype: rec[6] || "Continuous", flags: num(rec[70], 0), plot: rec[290] == null ? 1 : num(rec[290], 1), lw: num(rec[370], -3) };
        else if (table === "STYLE" && nm != null) dxf.styles[nm] = { name: nm, font: rec[3] || "", bigfont: rec[4] || "", width: num(rec[41], 1), height: num(rec[40], 0) };
        else if (table === "DIMSTYLE" && nm != null) dxf.dimstyles[nm] = Object.assign({ name: nm }, rec);
        else if (table === "LTYPE" && nm != null) dxf.ltypes[nm] = { name: nm, desc: rec[3] || "" };
        rec = null;
      }
      while (q < n && !(pairs[q][0] === 0 && pairs[q][1] === "ENDSEC")) {
        var c = pairs[q][0], val = pairs[q][1];
        if (c === 0) {
          flush();
          if (val === "TABLE") { table = pairs[q + 1][1]; q += 2; continue; }
          if (val === "ENDTAB") { table = null; }
          else if (table && val === table) rec = {};
        } else if (rec) {
          if (rec[c] === undefined) rec[c] = val;
        }
        q++;
      }
      flush();
      return q;
    }
    function readBlocks(q) {
      while (q < n && !(pairs[q][0] === 0 && pairs[q][1] === "ENDSEC")) {
        if (pairs[q][0] === 0 && pairs[q][1] === "BLOCK") {
          var b = { name: "", x: 0, y: 0, layer: "0", flags: 0 }; q++;
          while (q < n && pairs[q][0] !== 0) {
            var c = pairs[q][0], val = pairs[q][1];
            if (c === 2) b.name = val; else if (c === 10) b.x = +val; else if (c === 20) b.y = +val; else if (c === 8) b.layer = val; else if (c === 70) b.flags = +val;
            q++;
          }
          var r = readEntities(q, "ENDBLK"); b.entities = r.list; q = r.p;
          dxf.blocks[b.name] = b;
        }
        q++;
      }
      return q;
    }
    function readEntities(q, endTag) {
      var list = [];
      var lastInsert = null, lastPoly = null;
      while (q < n && !(pairs[q][0] === 0 && (pairs[q][1] === endTag || pairs[q][1] === "ENDSEC"))) {
        if (pairs[q][0] !== 0) { q++; continue; }
        var type = pairs[q][1]; q++;
        var g = []; // raw group list
        while (q < n && pairs[q][0] !== 0) { g.push(pairs[q]); q++; }
        var e = build(type, g);
        if (!e) continue;
        if (type === "ATTRIB") { if (lastInsert) lastInsert.attribs.push(e); continue; }
        if (type === "VERTEX") { if (lastPoly) lastPoly.pts.push({ x: e.x, y: e.y, b: e.bulge || 0 }); continue; }
        if (type === "SEQEND") { lastPoly = null; lastInsert = null; continue; }
        if (type === "INSERT") lastInsert = e;
        if (type === "POLYLINE") { lastPoly = e; e.type = "LWPOLYLINE"; e.pts = []; }
        list.push(e);
      }
      return { list: list, p: q };
    }
  }

  function num(v, d) { var x = parseFloat(v); return isNaN(x) ? d : x; }

  function build(type, g) {
    var e = { type: type, layer: "0", color: 256, linetype: "BYLAYER", ltscale: 1, handle: "" };
    function first(c) { for (var i = 0; i < g.length; i++) if (g[i][0] === c) return g[i][1]; return undefined; }
    var c, i;
    for (i = 0; i < g.length; i++) {
      c = g[i][0];
      if (c === 8) e.layer = g[i][1]; else if (c === 62) e.color = +g[i][1]; else if (c === 6) e.linetype = g[i][1];
      else if (c === 48) e.ltscale = +g[i][1]; else if (c === 5) e.handle = g[i][1]; else if (c === 67) e.paper = +g[i][1];
    }
    switch (type) {
      case "LINE":
        e.x1 = num(first(10), 0); e.y1 = num(first(20), 0); e.x2 = num(first(11), 0); e.y2 = num(first(21), 0); break;
      case "LWPOLYLINE":
        e.closed = (num(first(70), 0) & 1) === 1; e.pts = [];
        for (i = 0; i < g.length; i++) {
          if (g[i][0] === 10) e.pts.push({ x: +g[i][1], y: 0, b: 0 });
          else if (g[i][0] === 20 && e.pts.length) e.pts[e.pts.length - 1].y = +g[i][1];
          else if (g[i][0] === 42 && e.pts.length) e.pts[e.pts.length - 1].b = +g[i][1];
        }
        break;
      case "POLYLINE":
        e.closed = (num(first(70), 0) & 1) === 1; break;
      case "VERTEX":
        e.x = num(first(10), 0); e.y = num(first(20), 0); e.bulge = num(first(42), 0); break;
      case "CIRCLE":
        e.x = num(first(10), 0); e.y = num(first(20), 0); e.r = num(first(40), 0); break;
      case "ARC":
        e.x = num(first(10), 0); e.y = num(first(20), 0); e.r = num(first(40), 0); e.a1 = num(first(50), 0); e.a2 = num(first(51), 0); break;
      case "TEXT": case "ATTRIB": case "ATTDEF":
        e.text = stripCodes(decodeU(first(1) || "")); e.raw = first(1) || "";
        e.x = num(first(10), 0); e.y = num(first(20), 0);
        e.ax = num(first(11), e.x); e.ay = num(first(21), e.y);
        e.h = num(first(40), 0); e.wf = num(first(41), 1); e.rot = num(first(50), 0);
        e.style = first(7) || "Standard"; e.hj = num(first(72), 0); e.vj = num(first(type === "TEXT" ? 73 : 74), 0);
        e.tag = first(2) || "";
        if (e.hj || e.vj) { e.px = e.ax; e.py = e.ay; } else { e.px = e.x; e.py = e.y; }
        break;
      case "MTEXT":
        var t = ""; for (i = 0; i < g.length; i++) if (g[i][0] === 3) t += g[i][1];
        t += first(1) || ""; e.raw = t; e.text = stripCodes(cleanMText(t));
        e.x = e.px = num(first(10), 0); e.y = e.py = num(first(20), 0); e.h = num(first(40), 0); e.rot = num(first(50), 0);
        e.wf = 1; e.style = first(7) || "Standard"; e.attach = num(first(71), 1); e.boxw = num(first(41), 0);
        break;
      case "INSERT":
        e.name = first(2) || ""; e.x = num(first(10), 0); e.y = num(first(20), 0);
        e.sx = num(first(41), 1); e.sy = num(first(42), e.sx); e.rot = num(first(50), 0); e.attribs = [];
        break;
      case "DIMENSION":
        e.block = first(2) || ""; e.style = first(3) || "Standard"; e.over = first(1);
        e.x = num(first(10), 0); e.y = num(first(20), 0); e.tx = num(first(11), 0); e.ty = num(first(21), 0);
        e.x13 = num(first(13), 0); e.y13 = num(first(23), 0); e.x14 = num(first(14), 0); e.y14 = num(first(24), 0);
        e.dimtype = num(first(70), 0) & 15; e.meas = num(first(42), NaN); e.rotd = num(first(50), 0);
        e.xdata = []; for (i = 0; i < g.length; i++) if (g[i][0] >= 1000) e.xdata.push(g[i]);
        break;
      case "HATCH":
        e.pattern = first(2) || ""; e.solid = num(first(70), 0) === 1; e.pts = []; e.scale = num(first(41), 1); e.angle = num(first(52), 0);
        var inB = false;
        for (i = 0; i < g.length; i++) {
          if (g[i][0] === 91) inB = true;
          if (g[i][0] === 75 || g[i][0] === 98) inB = false;
          if (inB && g[i][0] === 10) e.pts.push({ x: +g[i][1], y: 0 });
          if (inB && g[i][0] === 20 && e.pts.length) e.pts[e.pts.length - 1].y = +g[i][1];
        }
        break;
      case "LEADER":
        e.pts = []; for (i = 0; i < g.length; i++) { if (g[i][0] === 10) e.pts.push({ x: +g[i][1], y: 0 }); if (g[i][0] === 20 && e.pts.length) e.pts[e.pts.length - 1].y = +g[i][1]; }
        break;
      case "SEQEND": break;
      default: break;
    }
    return e;
  }

  // ---------- block explode (world geometry) ----------
  function mat(x, y, sx, sy, rotDeg, bx, by) {
    var r = rotDeg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return function (px, py) { var X = (px - bx) * sx, Y = (py - by) * sy; return [x + X * c - Y * s, y + X * s + Y * c]; };
  }
  function explode(dxf, opt) {
    opt = opt || {};
    var out = [];
    var maxDepth = 6;
    function walk(list, T, inheritLayer, depth, rot, scl, blockName) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.paper) continue;
        var layer = (e.layer === "0" && inheritLayer) ? inheritLayer : e.layer;
        var o, p, k;
        switch (e.type) {
          case "LINE":
            var a = T(e.x1, e.y1), b = T(e.x2, e.y2);
            out.push({ type: "LINE", layer: layer, x1: a[0], y1: a[1], x2: b[0], y2: b[1], src: e, blk: blockName }); break;
          case "LWPOLYLINE":
            o = { type: "PLINE", layer: layer, closed: e.closed, pts: [], src: e, blk: blockName };
            for (k = 0; k < e.pts.length; k++) { p = T(e.pts[k].x, e.pts[k].y); o.pts.push({ x: p[0], y: p[1], b: e.pts[k].b }); }
            if (!o.closed && o.pts.length > 2 && dist(o.pts[0], o.pts[o.pts.length - 1]) < 1e-6) { o.closed = true; o.pts.pop(); }
            out.push(o); break;
          case "CIRCLE":
            p = T(e.x, e.y); out.push({ type: "CIRCLE", layer: layer, x: p[0], y: p[1], r: e.r * Math.abs(scl), src: e, blk: blockName }); break;
          case "ARC":
            p = T(e.x, e.y); out.push({ type: "ARC", layer: layer, x: p[0], y: p[1], r: e.r * Math.abs(scl), a1: e.a1 + rot, a2: e.a2 + rot, src: e, blk: blockName }); break;
          case "TEXT": case "MTEXT": case "ATTRIB":
            p = T(e.px, e.py);
            out.push({ type: "TEXT", layer: layer, text: e.text, x: p[0], y: p[1], h: e.h * Math.abs(scl), rot: e.rot + rot, wf: e.wf, style: e.style, kind: e.type, hj: e.hj, vj: e.vj, attach: e.attach, src: e, blk: blockName });
            break;
          case "INSERT":
            if (e.attribs) for (k = 0; k < e.attribs.length; k++) {
              var at = e.attribs[k], q = [at.px, at.py]; // attribs are already in WCS of parent space
              var w = T(q[0], q[1]);
              out.push({ type: "TEXT", layer: (at.layer === "0" && inheritLayer) ? inheritLayer : at.layer, text: at.text, tag: at.tag, x: w[0], y: w[1], h: at.h * Math.abs(scl), rot: at.rot + rot, wf: at.wf, style: at.style, kind: "ATTRIB", src: at, blk: blockName || e.name });
            }
            var B = dxf.blocks[e.name];
            if (!B || depth >= maxDepth) break;
            if (opt.skipBlock && opt.skipBlock(e.name)) break;
            var T2 = (function (T, e, B) { var m = mat(e.x, e.y, e.sx, e.sy, e.rot, B.x, B.y); return function (px, py) { var r = m(px, py); return T(r[0], r[1]); }; })(T, e, B);
            walk(B.entities, T2, layer, depth + 1, rot + e.rot, scl * e.sx, blockName || e.name);
            break;
          case "HATCH":
            o = { type: "HATCH", layer: layer, pattern: e.pattern, solid: e.solid, pts: [], src: e, blk: blockName };
            for (k = 0; k < e.pts.length; k++) { p = T(e.pts[k].x, e.pts[k].y); o.pts.push({ x: p[0], y: p[1] }); }
            out.push(o); break;
          case "DIMENSION":
            o = { type: "DIM", layer: layer, src: e, blk: blockName };
            p = T(e.x13, e.y13); o.x1 = p[0]; o.y1 = p[1]; p = T(e.x14, e.y14); o.x2 = p[0]; o.y2 = p[1];
            p = T(e.x, e.y); o.dx = p[0]; o.dy = p[1]; p = T(e.tx, e.ty); o.tx = p[0]; o.ty = p[1];
            out.push(o); break;
          default: break;
        }
      }
    }
    walk(dxf.entities, function (x, y) { return [x, y]; }, null, 0, 0, 1, null);
    return out;
  }

  // ---------- geometry ----------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function bboxPts(pts) {
    var b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    for (var i = 0; i < pts.length; i++) { var p = pts[i]; if (p.x < b.x1) b.x1 = p.x; if (p.y < b.y1) b.y1 = p.y; if (p.x > b.x2) b.x2 = p.x; if (p.y > b.y2) b.y2 = p.y; }
    return b;
  }
  function polyArea(pts) { var a = 0; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y); return Math.abs(a / 2); }
  function isRect(pts, tol) {
    tol = tol || 1;
    if (pts.length !== 4) return false;
    var b = bboxPts(pts);
    for (var i = 0; i < 4; i++) {
      var p = pts[i];
      var onX = Math.abs(p.x - b.x1) < tol || Math.abs(p.x - b.x2) < tol, onY = Math.abs(p.y - b.y1) < tol || Math.abs(p.y - b.y2) < tol;
      if (!onX || !onY) return false;
    }
    return true;
  }
  function pointInPoly(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy, t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function textWidth(t) { // approx Arial width in units of h, before width factor
    var w = 0, s = String(t);
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (" il.,:;|!'".indexOf(ch) >= 0) w += 0.28; else if ("()[]-/".indexOf(ch) >= 0) w += 0.33;
      else if ("MWmw".indexOf(ch) >= 0) w += 0.83; else if (/[A-Z]/.test(ch)) w += 0.68; else if (/[0-9]/.test(ch)) w += 0.556; else w += 0.6;
    }
    return w;
  }
  function textBox(t) { // world bbox of TEXT entity (axis aligned, rot 0/90 approx)
    var w = textWidth(t.text) * t.h * (t.wf || 1), h = t.h;
    var x = t.x, y = t.y, kind = t.kind;
    var hj = t.hj || 0, vj = t.vj || 0;
    if (kind === "MTEXT") { var a = t.attach || 1; hj = (a - 1) % 3; vj = 3 - Math.floor((a - 1) / 3); }
    var x0 = hj === 1 || hj === 4 ? x - w / 2 : hj === 2 ? x - w : x;
    var y0 = vj === 2 || hj === 4 ? y - h / 2 : vj === 3 ? y - h : y;
    var r = ((t.rot || 0) % 360 + 360) % 360;
    if (Math.abs(r - 90) < 1 || Math.abs(r - 270) < 1) return { x1: x - h / 2, y1: y0 - (x0 - x), x2: x + h / 2, y2: y0 - (x0 - x) + w, w: h, h: w };
    return { x1: x0, y1: y0, x2: x0 + w, y2: y0 + h, w: w, h: h };
  }
  function boxOverlap(a, b, shrink) {
    shrink = shrink || 0;
    return a.x1 + shrink < b.x2 - shrink && b.x1 + shrink < a.x2 - shrink && a.y1 + shrink < b.y2 - shrink && b.y1 + shrink < a.y2 - shrink;
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d");
  }

  var API = { parse: parse, explode: explode, decodeU: decodeU, cleanMText: cleanMText, bboxPts: bboxPts, polyArea: polyArea, isRect: isRect,
    pointInPoly: pointInPoly, segDist: segDist, textWidth: textWidth, textBox: textBox, boxOverlap: boxOverlap, dist: dist, norm: norm, num: num };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSADXF = API;
})(typeof window !== "undefined" ? window : this);
