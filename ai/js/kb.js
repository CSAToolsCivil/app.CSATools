/* CSA AI – bộ tìm kiếm kho kiến thức cục bộ (không tốn token) */
(function (root) {
  "use strict";
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  }
  var STOP = ("la cua va cac nhung the nao lam sao cach gi khong co duoc toi minh ban anh em oi a nhe nha voi cho de thi ma " +
    "trong khi bi o tai sao vay do nay kia mot hay hoac la nhu duoc roi can phai muon hoi giup xin chao " +
    "the an is are am was how do does did i to of in on for what my can why with it this that please me you your there when where which should would could get").split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  // từ đồng nghĩa / viết tắt hay gặp
  var SYN = {
    "login": "dang nhap", "log": "dang nhap", "pass": "mat khau", "password": "mat khau", "dk": "dang ky",
    "cad": "autocad", "acad": "autocad", "xl": "excel", "etab": "etabs", "e2k": "template etabs",
    "macro": "macro code", "vba": "code vba", "loi": "loi", "err": "loi", "error": "loi",
    "mcn": "mat cat ngang", "mbkc": "mat bang ket cau", "tk": "thong ke", "ve": "ve", "trien": "trien khai",
    "update": "cap nhat", "setup": "cai dat", "install": "cai dat", "ribbon": "tab ribbon", "tab": "ribbon",
    "coc": "coc", "mong": "mong", "dai": "dai", "san": "san", "dam": "dam", "cot": "cot", "vach": "vach", "loi thang": "core"
  };
  function tokens(s) {
    var t = norm(s).replace(/[^a-z0-9_\.\-]+/g, " ").split(/\s+/).filter(function (w) { return w && !STOPSET[w]; });
    var out = [];
    t.forEach(function (w) { out.push(w); if (SYN[w]) SYN[w].split(" ").forEach(function (x) { out.push(x); }); });
    for (var i = 0; i + 1 < t.length; i++) out.push(t[i] + "_" + t[i + 1]);
    return out;
  }

  function Engine(entries) {
    this.docs = [];
    this.df = {};
    var self = this;
    (entries || []).forEach(function (e) { self.add(e); });
    this.finish();
  }
  Engine.prototype.add = function (e) {
    var title = e.title || "", kw = e.keywords || "", ans = e.answer || "";
    var tf = {};
    function put(text, w) { tokens(text).forEach(function (t) { tf[t] = (tf[t] || 0) + w; }); }
    put(title, 3); put(kw, 2); put(ans, 0.5); put(e.category || "", 1); put(e.id || "", 2);
    put(e.title_en || "", 3); put(e.keywords_en || "", 2); put(e.answer_en || "", 0.5);
    var len = 0; for (var k in tf) len += tf[k];
    this.docs.push({ e: e, tf: tf, len: len, codes: (ans + " " + title + " " + kw + " " + (e.answer_en || "")).match(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/g) || [] });
  };
  Engine.prototype.finish = function () {
    var df = {}, total = 0;
    this.docs.forEach(function (d) { total += d.len; for (var t in d.tf) df[t] = (df[t] || 0) + 1; });
    this.df = df; this.avg = this.docs.length ? total / this.docs.length : 1; this.N = this.docs.length;
  };
  Engine.prototype.search = function (q, k) {
    k = k || 5;
    var qt = tokens(q), self = this, k1 = 1.4, b = 0.6;
    var upperCodes = String(q).toUpperCase().match(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/g) || [];
    var res = this.docs.map(function (d) {
      var s = 0, hit = 0, uniq = {};
      qt.forEach(function (t) {
        if (uniq[t]) return; uniq[t] = 1;
        var f = d.tf[t]; if (!f) return; hit++;
        var idf = Math.log(1 + (self.N - self.df[t] + 0.5) / (self.df[t] + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / self.avg));
      });
      upperCodes.forEach(function (c) { if (d.codes.indexOf(c) >= 0) s += 8; });
      var nq = Object.keys(uniq).length || 1;
      return { e: d.e, score: s, cover: hit / nq };
    }).filter(function (r) { return r.score > 0; });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.slice(0, k);
  };
  // độ tin cậy: đủ chắc để trả lời không cần AI
  Engine.prototype.confident = function (r) {
    if (!r || !r.length) return false;
    var top = r[0];
    if (top.score >= 9) return true;
    if (top.score >= 5 && top.cover >= 0.4) return true;
    if (top.score >= 3.5 && top.cover >= 0.6 && (!r[1] || top.score >= 1.25 * r[1].score)) return true;
    return false;
  };

  function videoLinks(v, titles) {
    if (!v) return [];
    return String(v).split(/[;,\n]/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
      var m = x.match(/^([\w-]{11})(?:@(\d+))?$/);
      if (!m) return null;
      var t = +(m[2] || 0);
      return { id: m[1], t: t, url: "https://www.youtube.com/watch?v=" + m[1] + (t ? "&t=" + t + "s" : ""),
        label: (titles && titles[m[1]] ? titles[m[1]] : "Video hướng dẫn") + (t ? " – " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0") : "") };
    }).filter(Boolean);
  }

  var API = { Engine: Engine, tokens: tokens, norm: norm, videoLinks: videoLinks };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSAKB = API;
})(typeof window !== "undefined" ? window : this);
