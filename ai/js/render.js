/* CSA AI – vẽ preview SVG cho bản vẽ (kết quả dựng MBKC hoặc DXF đã đọc) */
(function (root) {
  "use strict";
  var D = (typeof module !== "undefined" && module.exports) ? require("./dxf.js") : root.CSADXF;
  var ACI = { 1: "#e5484d", 2: "#e2b300", 3: "#30a46c", 4: "#0bb5c9", 5: "#3e63dd", 6: "#c34dc3", 7: "#cfd6e2", 8: "#8b93a1", 9: "#b8bec9", 30: "#f08c2e", 60: "#9cc23a", 250: "#5b6270", 251: "#6b7280" };
  function col(c) { c = Math.abs(c || 7); return ACI[c] || "#9aa3b2"; }
  var DASH = { HIDDEN: "6 4", CENTER: "18 4 4 4" };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // G: kết quả builder ; layerDef: {name:{color,lt}}
  function fromBuild(res, layerDef) {
    var G = res.G, items = [];
    G.lines.forEach(function (l) { items.push({ t: "l", L: l.layer, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }); });
    G.plines.forEach(function (p) { items.push({ t: "p", L: p.layer, pts: p.pts.map(function (q) { return { x: q[0], y: q[1] }; }), closed: true, fill: p.col && G.hatchCols }); });
    G.circles.forEach(function (c) { items.push({ t: "c", L: c.layer, x: c.x, y: c.y, r: c.r }); });
    G.texts.forEach(function (t) { items.push({ t: "t", L: t.layer, x: t.x, y: t.y, h: t.h, s: t.text, rot: t.rot, mc: t.mc, wf: t.style === "arial-bold-1.0" ? 1 : 0.7 }); });
    G.dims.forEach(function (d) {
      var len = Math.abs(d.h ? d.x2 - d.x1 : d.y2 - d.y1); if (len < 1) return;
      if (d.h) { items.push({ t: "l", L: "KCS_DIM", x1: d.x1, y1: d.at, x2: d.x2, y2: d.at }); items.push({ t: "l", L: "KCS_DIM", x1: d.x1, y1: d.y1, x2: d.x1, y2: d.at }); items.push({ t: "l", L: "KCS_DIM", x1: d.x2, y1: d.y2, x2: d.x2, y2: d.at });
        items.push({ t: "t", L: "DIMTXT", x: (d.x1 + d.x2) / 2, y: d.at + 1.6 * G.N, h: 2.2 * G.N, s: String(Math.round(len)), rot: 0, mc: true, wf: 0.7 }); }
      else { items.push({ t: "l", L: "KCS_DIM", x1: d.at, y1: d.y1, x2: d.at, y2: d.y2 }); items.push({ t: "l", L: "KCS_DIM", x1: d.x1, y1: d.y1, x2: d.at, y2: d.y1 }); items.push({ t: "l", L: "KCS_DIM", x1: d.x2, y1: d.y2, x2: d.at, y2: d.y2 });
        items.push({ t: "t", L: "DIMTXT", x: d.at - 1.6 * G.N, y: (d.y1 + d.y2) / 2, h: 2.2 * G.N, s: String(Math.round(len)), rot: 90, mc: true, wf: 0.7 }); }
    });
    if (G.frame) {
      var F = G.frame, P = [F.W, F.H], x = F.x, y = F.y, n = F.N;
      [[0, 0, P[0], P[1]], [15, 5, P[0] - 5, P[1] - 5]].forEach(function (r) { items.push({ t: "p", L: "KCS_MANH", pts: [{ x: x + r[0] * n, y: y + r[1] * n }, { x: x + r[2] * n, y: y + r[1] * n }, { x: x + r[2] * n, y: y + r[3] * n }, { x: x + r[0] * n, y: y + r[3] * n }], closed: true }); });
      items.push({ t: "l", L: "KCS_MANH", x1: x + (P[0] - 55) * n, y1: y + 5 * n, x2: x + (P[0] - 55) * n, y2: y + (P[1] - 5) * n });
    }
    var def = layerDef || {};
    return svg(items, function (L) { return def[L] || { color: L === "DIMTXT" ? 60 : 7, lt: "" }; }, []);
  }

  function fromEnts(ents, layers, markers) {
    var items = [];
    ents.forEach(function (e) {
      if (e.type === "LINE") items.push({ t: "l", L: e.layer, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 });
      else if (e.type === "PLINE") items.push({ t: "p", L: e.layer, pts: e.pts, closed: e.closed });
      else if (e.type === "CIRCLE") items.push({ t: "c", L: e.layer, x: e.x, y: e.y, r: e.r });
      else if (e.type === "TEXT" && e.text) { var b = D.textBox(e); items.push({ t: "t", L: e.layer, x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2, h: e.h, s: e.text, rot: e.rot, mc: true, wf: e.wf || 1 }); }
      else if (e.type === "DIM") {
        var rr = (e.src.rotd || 0) % 180, horiz = Math.abs(rr) < 1 || (Math.abs(rr - 90) > 1 && Math.abs(e.y1 - e.y2) < Math.abs(e.x1 - e.x2));
        if (horiz) { items.push({ t: "l", L: e.layer, x1: e.x1, y1: e.dy, x2: e.x2, y2: e.dy }); items.push({ t: "l", L: e.layer, x1: e.x1, y1: e.y1, x2: e.x1, y2: e.dy }); items.push({ t: "l", L: e.layer, x1: e.x2, y1: e.y2, x2: e.x2, y2: e.dy }); }
        else { items.push({ t: "l", L: e.layer, x1: e.dx, y1: e.y1, x2: e.dx, y2: e.y2 }); items.push({ t: "l", L: e.layer, x1: e.x1, y1: e.y1, x2: e.dx, y2: e.y1 }); items.push({ t: "l", L: e.layer, x1: e.x2, y1: e.y2, x2: e.dx, y2: e.y2 }); }
        var val = isNaN(e.src.meas) ? "" : String(Math.round(e.src.meas)); if (e.src.over && e.src.over !== "<>") val = D.decodeU(e.src.over).replace(/<>/g, val);
        if (val) items.push({ t: "t", L: "DIMTXT", x: e.tx, y: e.ty, h: Math.max(Math.abs(e.x2 - e.x1), Math.abs(e.y2 - e.y1)) / 25, s: val, rot: horiz ? 0 : 90, mc: true, wf: 0.7 });
      }
    });
    return svg(items, function (L) { if (L === "DIMTXT") return { color: 60, lt: "" }; var l = layers[L]; return l ? { color: l.color, lt: String(l.linetype || "").toUpperCase() } : { color: 7, lt: "" }; }, markers || []);
  }

  function svg(items, look, markers) {
    var b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
    function g(x, y) { if (!isFinite(x) || !isFinite(y)) return; b.x1 = Math.min(b.x1, x); b.y1 = Math.min(b.y1, y); b.x2 = Math.max(b.x2, x); b.y2 = Math.max(b.y2, y); }
    items.forEach(function (i) { if (i.t === "l") { g(i.x1, i.y1); g(i.x2, i.y2); } else if (i.t === "p") i.pts.forEach(function (p) { g(p.x, p.y); }); else { g(i.x, i.y); } });
    if (!isFinite(b.x1)) return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'></svg>";
    var W = b.x2 - b.x1 || 1, H = b.y2 - b.y1 || 1, pad = Math.max(W, H) * 0.02;
    var vb = (b.x1 - pad) + " " + (-b.y2 - pad) + " " + (W + 2 * pad) + " " + (H + 2 * pad);
    var sw = Math.max(W, H) / 1400, o = [];
    o.push("<svg xmlns='http://www.w3.org/2000/svg' viewBox='" + vb + "' preserveAspectRatio='xMidYMid meet' style='background:#11161f'><g transform='scale(1,-1)'>");
    items.forEach(function (i) {
      var lk = look(i.L), c = col(lk.color), da = DASH[lk.lt] ? " stroke-dasharray='" + DASH[lk.lt].split(" ").map(function (v) { return v * sw * 4; }).join(" ") + "'" : "";
      if (i.t === "l") o.push("<line x1='" + i.x1 + "' y1='" + i.y1 + "' x2='" + i.x2 + "' y2='" + i.y2 + "' stroke='" + c + "' stroke-width='" + sw + "'" + da + "/>");
      else if (i.t === "p") o.push("<polygon points='" + i.pts.map(function (p) { return p.x + "," + p.y; }).join(" ") + "' fill='" + (i.fill ? c : "none") + "' fill-opacity='0.35' stroke='" + c + "' stroke-width='" + sw + "'" + da + (i.closed ? "" : " ") + "/>");
      else if (i.t === "c") o.push("<circle cx='" + i.x + "' cy='" + i.y + "' r='" + i.r + "' fill='none' stroke='" + c + "' stroke-width='" + sw + "'/>");
      else if (i.t === "t") {
        o.push("<text x='" + i.x + "' y='" + (-i.y) + "' transform='scale(1,-1) rotate(" + (-(i.rot || 0)) + " " + i.x + " " + (-i.y) + ")' font-family='Arial' font-size='" + i.h * 1.0 + "' textLength='" + (D.textWidth(i.s) * i.h * (i.wf || 0.7)) + "' lengthAdjust='spacingAndGlyphs' fill='" + c + "' text-anchor='middle' dominant-baseline='central'>" + esc(i.s) + "</text>");
      }
    });
    markers.forEach(function (m) {
      if (m.x == null || isNaN(m.x)) return;
      var r = Math.max(W, H) / 90, cc = m.sev === "error" ? "#ff4d4f" : m.sev === "warn" ? "#ffb020" : "#4aa3ff";
      o.push("<g class='mk' data-no='" + m.no + "'><circle cx='" + m.x + "' cy='" + m.y + "' r='" + r + "' fill='" + cc + "' fill-opacity='0.18' stroke='" + cc + "' stroke-width='" + sw * 2 + "'/>" +
        "<text x='" + m.x + "' y='" + (-m.y) + "' transform='scale(1,-1)' font-size='" + r * 0.9 + "' fill='" + cc + "' text-anchor='middle' dominant-baseline='central' font-family='Arial' font-weight='700'>" + m.no + "</text></g>");
    });
    o.push("</g></svg>");
    return o.join("");
  }

  var API = { fromBuild: fromBuild, fromEnts: fromEnts };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSARender = API;
})(typeof window !== "undefined" ? window : this);
