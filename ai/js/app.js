/* CSA AI – giao diện chính */
(function () {
  "use strict";
  var C = window.CSA_CONFIG, $ = function (s) { return document.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var DEMO = !!window.CSA_DEMO;
  var FREE = !DEMO && C.FREE !== false;
  var S = { sess: null, eng: null, kbAll: [], notes: [], gnotes: [], hist: [], att: null, web: false, cfg: loadCfg(), lang: "vi" };
  var I = window.CSAI18N, T = function (k, v, lang) { return I.T(k, lang || S.lang, Object.assign({ phone: C.PHONE }, v || {})); };
  function msg(code) { return S.lang === "en" && I.MSG_EN[code] ? I.MSG_EN[code].replace("{phone}", C.PHONE) : (MSG[code] || code); }

  // ---------------- tiện ích ----------------
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function loadCfg() { return Object.assign({ provider: "", keys: {}, models: {}, web: false, ocr: true }, ls("csa_ai_cfg") || {}); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function md(src) {
    var lines = String(src || "").replace(/\r/g, "").split("\n"), out = [], list = null, tbl = null;
    function inl(s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
      s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "<a href='$2' target='_blank' rel='noopener'>$1</a>");
      s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, "$1<a href='$2' target='_blank' rel='noopener'>$2</a>");
      return s;
    }
    function close() { if (list) { out.push("</" + list + ">"); list = null; } if (tbl) { out.push("</table>"); tbl = null; } }
    lines.forEach(function (l) {
      var t = l.trim();
      if (/^\|.*\|$/.test(t)) {
        if (/^\|[\s:|-]+\|$/.test(t)) return;
        var cells = t.slice(1, -1).split("|").map(function (c) { return inl(c.trim()); });
        if (!tbl) { close(); tbl = 1; out.push("<table><tr>" + cells.map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr>"); }
        else out.push("<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>");
        return;
      }
      var m;
      if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) { if (list !== "ol") { close(); list = "ol"; out.push("<ol>"); } out.push("<li>" + inl(m[2]) + "</li>"); return; }
      if ((m = t.match(/^[-*+•]\s+(.*)$/))) { if (list !== "ul") { close(); list = "ul"; out.push("<ul>"); } out.push("<li>" + inl(m[1]) + "</li>"); return; }
      close();
      if ((m = t.match(/^#{1,4}\s+(.*)$/))) { out.push("<p><b>" + inl(m[1]) + "</b></p>"); return; }
      if (t) out.push("<p>" + inl(t) + "</p>");
    });
    close();
    return out.join("");
  }
  function jsonp(params, timeout) {
    if (DEMO) return Promise.resolve(window.CSA_DEMO.api(params));
    return new Promise(function (res, rej) {
      var cb = "csaai_" + Date.now() + "_" + Math.floor(Math.random() * 1e6), sc = document.createElement("script"), done = false;
      var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k] == null ? "" : params[k]); }).join("&");
      window[cb] = function (d) { done = true; cleanup(); res(d); };
      function cleanup() { try { delete window[cb]; } catch (e) { window[cb] = undefined; } if (sc.parentNode) sc.parentNode.removeChild(sc); }
      sc.onerror = function () { if (!done) { cleanup(); rej(new Error("NETWORK")); } };
      setTimeout(function () { if (!done) { cleanup(); rej(new Error("TIMEOUT")); } }, timeout || 25000);
      sc.src = C.SERVER_URL + "?" + q + "&callback=" + cb + "&_=" + Date.now();
      document.head.appendChild(sc);
    });
  }
  function api(action, extra) {
    var p = FREE ? Object.assign({ action: action, user: S.sess && S.sess.user, free: 1 }, extra || {})
      : Object.assign({ action: action, user: S.sess && S.sess.user, sid: S.sess && S.sess.sid, token: S.sess && S.sess.token }, extra || {});
    return jsonp(p).then(function (r) {
      if (r && (r.message === "DANG_NHAP_NOI_KHAC" || r.message === "PHIEN_HET_HAN" || r.message === "HET_HAN" || r.message === "CHUA_DUOC_DUYET")) { logout(msg(r.message)); throw new Error(r.message); }
      return r;
    });
  }
  var MSG = {
    SAI_THONG_TIN: "Sai tên đăng nhập hoặc mật khẩu.", CHUA_DUOC_DUYET: "Tài khoản chưa được duyệt (chưa thanh toán hoặc Admin chưa kích hoạt). Liên hệ Zalo " + C.PHONE + ".",
    HET_HAN: "Bản quyền đã hết hạn – liên hệ Admin để gia hạn.", KHOA_TAM_15_PHUT: "Sai quá nhiều lần – vui lòng thử lại sau 15 phút.",
    DANG_NHAP_NOI_KHAC: "Tài khoản vừa đăng nhập ở nơi khác – phiên này đã thoát (mỗi tài khoản 1 nơi).", PHIEN_HET_HAN: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
    THIEU_THONG_TIN: "Nhập đủ tên đăng nhập và mật khẩu.", NETWORK: "Không kết nối được máy chủ CSA – kiểm tra mạng rồi thử lại.", TIMEOUT: "Máy chủ phản hồi chậm – thử lại sau ít phút.", KB_FAIL: "Đăng nhập đúng nhưng chưa tải được kho kiến thức từ máy chủ – báo Admin kiểm tra sheet AI_KB."
  };
  function download(name, text, type) {
    var b = new Blob([text], { type: type || "text/plain" }), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------------- đăng nhập ----------------
  $("#lreg").href = C.SITE_URL; $("#lphone").textContent = C.PHONE;
  $("#lf").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var u = $("#lu").value.trim(), p = $("#lp").value;
    $("#lerr").textContent = ""; $("#lbtn").disabled = true; $("#lbtn").textContent = "Đang kiểm tra…";
    jsonp({ action: "ai_login", user: u, pass: p }).then(function (r) {
      if (!r.ok) { $("#lerr").textContent = msg(r.message); return; }
      S.sess = { user: r.user, sid: r.sid, token: r.token, expiry: r.expiry, license: r.license };
      ls("csa_ai_sess", S.sess); $("#lp").value = "";
      return enter();
    }).catch(function (e) { $("#lerr").textContent = msg(e.message === "NETWORK" && S.sess ? "KB_FAIL" : e.message); })
      .then(function () { $("#lbtn").disabled = false; $("#lbtn").textContent = "Đăng nhập"; });
  });
  function logout(msg) {
    if (S.sess && !msg) jsonp({ action: "ai_ping", user: S.sess.user, sid: "x", token: "x" }).catch(function () {});
    S.sess = null; ls("csa_ai_sess", null);
    $("#app").classList.add("hidden"); $("#login").classList.remove("hidden");
    $("#lerr").textContent = msg || "";
  }
  $("#blogout").onclick = function () { logout(); };
  // ---- chế độ miễn phí: kho tĩnh hiển thị ngay, kho trên sheet (AI_KB + đã học + lưu ý chung) nạp thêm nếu được ----
  function addNote(text) {
    var n = { row: 0, text: text }; S.notes.push(n); ls("csa_ai_notes", S.notes);
    return api("ai_note", { note: text }).then(function (r) { if (r && r.row) { n.row = r.row; ls("csa_ai_notes", S.notes); } return n; }).catch(function () { return n; });
  }
  function guestId() {
    var d = ls("csa_ai_dev");
    if (!d) { d = "khach-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); ls("csa_ai_dev", d); }
    return d;
  }
  function mergeKb(serverKb, learned) {
    var byId = {}, out = [];
    (window.CSA_KB_STATIC || []).forEach(function (e) { byId[e.id] = e; });
    (serverKb || []).forEach(function (e) { if (e && e.id) byId[e.id] = Object.assign({}, byId[e.id] || {}, e); });
    for (var k in byId) out.push(byId[k]);
    S.learnedN = (learned || []).length;
    return out.concat(learned || []);
  }
  function showApp() {
    S.eng = new CSAKB.Engine(S.kbAll);
    $("#login").classList.add("hidden"); $("#app").classList.remove("hidden");
    $("#hu").textContent = FREE ? T("freeUser") : S.sess.user;
    $("#hx").textContent = FREE ? "" : [S.sess.license, S.sess.expiry ? T("expiry", { d: S.sess.expiry }) : ""].filter(Boolean).join(" · ");
    kbInfo(); renderNotes(); renderQuick(); refreshMode();
  }
  function enterFree() {
    S.sess = { user: guestId(), free: true };
    S.notes = ls("csa_ai_notes") || []; S.gnotes = [];
    S.kbAll = mergeKb([], []); showApp();
    $("#blogout").classList.add("hidden");
    jsonp({ action: "ai_kb", user: S.sess.user, free: 1 }, 20000).then(function (r) {
      if (!r || !r.ok) return;
      S.kbAll = mergeKb(r.kb, r.learned); S.eng = new CSAKB.Engine(S.kbAll);
      S.gnotes = r.globalNotes || []; kbInfo(); renderNotes();
    }).catch(function () { /* không nạp được sheet → vẫn dùng kho tĩnh */ });
  }
  function enter() {
    return api("ai_kb").then(function (r) {
      if (!r.ok) throw new Error(r.message);
      S.kbAll = (r.kb || []).concat(r.learned || []);
      S.eng = new CSAKB.Engine(S.kbAll);
      S.notes = r.notes || []; S.gnotes = r.globalNotes || [];
      $("#login").classList.add("hidden"); $("#app").classList.remove("hidden");
      $("#hu").textContent = S.sess.user; $("#hx").textContent = [S.sess.license, S.sess.expiry ? T("expiry", { d: S.sess.expiry }) : ""].filter(Boolean).join(" · ");
      S.learnedN = (r.learned || []).length; kbInfo();
      renderNotes(); renderQuick(); refreshMode();
    });
  }

  function kbInfo() { $("#kbinfo").textContent = T("kbinfo", { n: S.kbAll.length }) + (S.learnedN ? T("learned", { n: S.learnedN }) : ""); }
  function setLang(l) {
    S.lang = l; ls("csa_ai_lang", l); document.documentElement.lang = l === "en" ? "en" : "vi";
    I.applyUI(l, [$("#login"), $("#app")]); $("#blang").textContent = l === "en" ? "VN" : "EN";
    renderQuick(); refreshMode(); if (S.eng) kbInfo(); renderNotes();
    if (CK.res) loadCheck(CK.name, CK.dx, CK.res);
  }
  // ---------------- điều hướng ----------------
  $$("nav button[data-v]").forEach(function (b) {
    b.onclick = function () {
      $$("nav button[data-v]").forEach(function (x) { x.classList.toggle("on", x === b); });
      $$(".view").forEach(function (v) { v.classList.toggle("hidden", v.id !== "v-" + b.dataset.v); });
    };
  });
  function go(v) { $("nav button[data-v='" + v + "']").click(); }
  $("#btheme").onclick = function () {
    var r = document.documentElement, cur = r.getAttribute("data-theme");
    var dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    r.setAttribute("data-theme", dark ? "light" : "dark"); ls("csa_ai_theme", dark ? "light" : "dark");
  };
  if (ls("csa_ai_theme")) document.documentElement.setAttribute("data-theme", ls("csa_ai_theme"));

  // ---------------- CHAT ----------------
  function renderQuick() {
    $("#quick").innerHTML = I.QUICK[S.lang].map(function (q) { return "<button class='q' data-q='" + esc(q[0]) + "'><b>" + esc(q[0]) + "</b><span>" + esc(q[1]) + "</span></button>"; }).join("");
    $$("#quick .q").forEach(function (b) { b.onclick = function () { ask(b.dataset.q); }; });
  }
  var tin = $("#tin");
  tin.addEventListener("input", function () { tin.style.height = "auto"; tin.style.height = Math.min(tin.scrollHeight, 160) + "px"; });
  tin.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  tin.addEventListener("paste", function (e) {
    var it = (e.clipboardData || {}).items || [];
    for (var i = 0; i < it.length; i++) if (it[i].type.indexOf("image") === 0) { setAttach(it[i].getAsFile()); e.preventDefault(); }
  });
  $("#bsend").onclick = send;
  $("#battach").onclick = function () { $("#fattach").click(); };
  $("#fattach").onchange = function () { if (this.files[0]) setAttach(this.files[0]); this.value = ""; };
  $("#msgs").addEventListener("dragover", function (e) { e.preventDefault(); });
  $("#msgs").addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) setAttach(e.dataTransfer.files[0]); });
  $("#bweb").onclick = function () {
    if (!S.cfg.provider) { toastBot(T("needAiWeb")); return; }
    S.web = !S.web; $("#bweb").classList.toggle("on", S.web); refreshMode();
  };
  function refreshMode() {
    var p = S.cfg.provider, nm = { gemini: "Gemini", claude: "Claude", openai: "ChatGPT" }[p];
    $("#aimode").textContent = p ? T("modeAi", { p: nm }) + (S.web ? " + Google" : "") : T("modeKb");
  }
  function setAttach(f) {
    S.att = f;
    var box = $("#attprev"); box.innerHTML = "";
    var d = document.createElement("div"); d.className = "a";
    if (/^image\//.test(f.type)) { var im = document.createElement("img"); im.src = URL.createObjectURL(f); d.appendChild(im); }
    d.appendChild(document.createTextNode(f.name || "ảnh dán"));
    var x = document.createElement("button"); x.className = "btn sm"; x.textContent = "✕"; x.onclick = function () { S.att = null; box.innerHTML = ""; };
    d.appendChild(x); box.appendChild(d);
    tin.focus();
  }
  function send() { var t = tin.value.trim(); if (!t && !S.att) return; tin.value = ""; tin.style.height = "auto"; ask(t, S.att); S.att = null; $("#attprev").innerHTML = ""; }
  function addMsg(who, html) {
    $("#welcome") && ($("#welcome").style.display = "none");
    var m = document.createElement("div"); m.className = "m " + who;
    m.innerHTML = (who === "bot" ? "<div class='av'><img src='logo.png' alt=''></div>" : "<div class='av'></div>") + "<div class='b'>" + html + "</div>";
    $("#msgs").appendChild(m); $("#msgs").scrollTop = 1e9; return m.querySelector(".b");
  }
  function toastBot(t) { addMsg("bot", md(t)); }
  function typing() { return addMsg("bot", "<span class='typing'><i></i><i></i><i></i></span>"); }

  var SECRET = /(m[ãa] ngu[ồo]n|source ?code|code vba|xem code|l[ấa]y code|g[ửu]i code|chia s[ẻe] code|thu[ậa]t to[áa]n|c[ôo]ng th[ứu]c (n[ộo]i b[ộo]|trong file|[ẩa]n)|unlock|crack|b[ẻe] kh[óo]a|m[ởo] kh[óo]a (vba|file|code)|pass(word)? (vba|project)|keygen|bypass|qua m[ặa]t b[ảa]n quy[ềe]n|hwid|c[áa]ch t[íi]nh m[ãa] m[áa]y)/i;
  var NOTE = /^\s*(l[ưu]u [ýy]|ghi nh[ớo]|nh[ớo] (gi[úu]p|gi[ùu]m|l[àa])|note|remember)\s*[:,-]?\s*/i;

  async function ask(text, file) {
    var userHtml = esc(text).replace(/\n/g, "<br>");
    if (file) userHtml += (/^image\//.test(file.type) ? "<img class='att' src='" + URL.createObjectURL(file) + "'>" : "<div>📎 " + esc(file.name) + "</div>");
    addMsg("me", userHtml || "📎");
    var L = I.detect(text, S.lang); S.qlang = L;
    if (text && SECRET.test(text)) {
      return answerBox({ src: "kb", text: T("secret", null, L), q: text, lang: L });
    }
    if (text && NOTE.test(text)) {
      var note = text.replace(NOTE, "").trim();
      if (note) {
        var w = typing();
        try { var r = FREE ? await addNote(note) : await api("ai_note", { note: note }); if (!FREE) S.notes.push({ row: r.row, text: note }); renderNotes(); w.innerHTML = md(T("noteSaved", { note: note }, L)); }
        catch (e) { w.innerHTML = md(T("noteFail", { err: msg(e.message) }, L)); }
        return;
      }
    }
    var w2 = typing();
    try {
      var ctx = { q: text || "", image: null, extra: "" };
      if (file) {
        if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) { await handleExcel(file, w2, text); return; }
        if (/\.dxf$/i.test(file.name)) { await handleDxfChat(file, w2); return; }
        if (/^image\//.test(file.type)) ctx.image = await imgData(file);
      }
      // OCR khi không có AI
      if (ctx.image && !S.cfg.provider && S.cfg.ocr) {
        w2.innerHTML = "<span class='tip'>" + T("ocr", null, L) + "</span>";
        var ocr = await runOCR(file).catch(function () { return ""; });
        if (ocr) ctx.extra = ocr;
      }
      var query = (ctx.q + " " + ctx.extra).trim();
      var hits = S.eng.search(query || "lỗi", 5), conf = S.eng.confident(hits);
      var useAI = !!S.cfg.provider && (!conf || ctx.image || S.web);
      if (!useAI && conf) {
        var e = hits[0].e;
        w2.parentNode.remove();
        var pre = ctx.extra ? T("ocrSeen", { t: ctx.extra.slice(0, 160).replace(/\s+/g, " ") }, L) + "\n\n" : "";
        var en = L === "en" && e.answer_en;
        return answerBox({ src: "kb", title: en ? (e.title_en || e.title) : e.title, text: pre + (en ? e.answer_en : e.answer), videos: e.videos, related: hits.slice(1, 4), q: text, entry: e, lang: L });
      }
      if (useAI) {
        var snips = hits.slice(0, 4).map(function (h) { return h.e; });
        var cacheKey = CSAKB.norm(query).replace(/\s+/g, " ").slice(0, 200) + "|" + (S.web ? 1 : 0) + "|" + L;
        var cache = ls("csa_ai_cache") || {};
        var out = (!ctx.image && cache[cacheKey]) ? cache[cacheKey] : null;
        if (!out) {
          out = await CSALLM.ask(S.cfg, { lang: L, question: (ctx.q || T("imgQ", null, L)) + (ctx.extra ? "\n(Chữ đọc được trong ảnh: " + ctx.extra + ")" : ""),
            history: S.hist, snippets: snips, notes: S.notes.map(function (n) { return n.text; }), globalNotes: S.gnotes, image: ctx.image, search: S.web || (S.cfg.web && !conf) });
          if (!ctx.image) { cache[cacheKey] = { text: out.text, sources: out.sources }; var ks = Object.keys(cache); if (ks.length > 80) delete cache[ks[0]]; ls("csa_ai_cache", cache); }
        }
        S.hist.push({ role: "user", content: ctx.q || "(ảnh)" }, { role: "assistant", content: out.text.slice(0, 1500) });
        w2.parentNode.remove();
        var vids = conf ? hits[0].e.videos : (hits[0] && hits[0].score > 4 ? hits[0].e.videos : "");
        answerBox({ src: "ai", text: out.text, sources: out.sources, videos: vids, related: hits.slice(0, 3), q: text, lang: L });
        if (!conf) api("ai_log", { type: "UNANSWERED", q: (text || "(ảnh)").slice(0, 600), a: ("[AI] " + out.text).slice(0, 400) }).catch(function () {});
        return;
      }
      // không chắc & không có AI
      w2.parentNode.remove();
      var txt = T("unknown", null, L) + "\n\n" + (hits.some(function (h) { return h.score >= 4; }) ? T("unknownRel", null, L) : "") + "\n\n" + T("unknownHelp", null, L);
      answerBox({ src: "none", text: txt, related: hits.filter(function (h) { return h.score >= 4; }).slice(0, 4), q: text, google: query, lang: L });
      api("ai_log", { type: "UNANSWERED", q: (text || "(ảnh) " + ctx.extra).slice(0, 600), a: "" }).catch(function () {});
    } catch (err) {
      w2.innerHTML = md(T("err", { err: esc(msg(err.message)) }, L) + (S.cfg.provider ? "\n\n" + T("errKey", null, L) : ""));
    }
  }

  function answerBox(o) {
    var L = o.lang || S.lang, en = L === "en";
    var h = "<div class='src " + (o.src === "ai" ? "ai" : o.src === "none" ? "none" : "") + "'><i></i>" + (o.src === "ai" ? T("srcAi", null, L) : o.src === "none" ? T("srcNone", null, L) : T("srcKb", null, L) + (o.title ? " · " + esc(o.title) : "")) + "</div>";
    h += md(o.text);
    var vl = CSAKB.videoLinks(o.videos, en ? C.VIDEOS_EN : C.VIDEOS);
    if (vl.length) h += "<div class='vids'>" + vl.slice(0, 4).map(function (v) { return "<a class='vid' href='" + v.url + "' target='_blank' rel='noopener'><img src='https://i.ytimg.com/vi/" + v.id + "/mqdefault.jpg' alt='' onerror=\"this.style.display='none'\"><span>▶ " + esc(v.label) + "</span></a>"; }).join("") + "</div>";
    if (o.sources && o.sources.length) h += "<div class='tip' style='margin-top:8px'>" + T("sources", null, L) + ": " + o.sources.map(function (s) { return "<a href='" + esc(s.url) + "' target='_blank' rel='noopener'>" + esc((s.title || s.url).slice(0, 60)) + "</a>"; }).join(" · ") + "</div>";
    var rel = (o.related || []).filter(function (r) { return !o.entry || r.e !== o.entry; });
    if (rel.length) h += "<div class='rel'>" + rel.map(function (r) { return "<button class='chip' data-q='" + esc(en && r.e.title_en ? r.e.title_en : r.e.title) + "'>" + esc(en && r.e.title_en ? r.e.title_en : r.e.title) + "</button>"; }).join("") + "</div>";
    if (o.google) h += "<div class='rel'><a class='chip' target='_blank' rel='noopener' href='https://www.google.com/search?q=" + encodeURIComponent(o.google) + "'>" + T("google", null, L) + "</a></div>";
    h += "<div class='fb'>" + T("useful", null, L) + " <button data-f='GOOD'>👍</button><button data-f='BAD'>👎</button>" + (o.src === "kb" && S.cfg.provider ? "<button data-f='DEEP'>" + T("deeper", null, L) + "</button>" : "") + "</div>";
    var b = addMsg("bot", h);
    b.querySelectorAll(".chip[data-q]").forEach(function (c) { c.onclick = function () { ask(c.dataset.q); }; });
    b.querySelectorAll(".fb button").forEach(function (fbtn) {
      fbtn.onclick = function () {
        var f = fbtn.dataset.f;
        if (f === "DEEP") { deepAsk(o.q, L); return; }
        b.querySelectorAll(".fb button").forEach(function (x) { x.classList.remove("on"); }); fbtn.classList.add("on");
        api("ai_log", { type: f, q: (o.q || "").slice(0, 600), a: String(o.text).slice(0, 400) }).catch(function () {});
        if (f === "BAD") toastBot(T("bad", null, L));
      };
    });
    S.hist.push({ role: "user", content: o.q || "" }, { role: "assistant", content: String(o.text).slice(0, 1200) });
    if (S.hist.length > 12) S.hist = S.hist.slice(-12);
  }
  async function deepAsk(q, L) {
    var w = typing();
    try {
      var hits = S.eng.search(q, 4);
      var out = await CSALLM.ask(S.cfg, { lang: L, question: q, history: S.hist, snippets: hits.map(function (h) { return h.e; }), notes: S.notes.map(function (n) { return n.text; }), globalNotes: S.gnotes, search: S.web });
      w.parentNode.remove(); answerBox({ src: "ai", text: out.text, sources: out.sources, q: q, lang: L });
    } catch (e) { w.innerHTML = md(T("deepFail", { err: esc(e.message) }, L)); }
  }
  function imgData(file) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.onload = function () {
        var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        res({ mime: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
      }; im.onerror = rej; im.src = URL.createObjectURL(file);
    });
  }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function runOCR(file) {
    if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
    var r = await window.Tesseract.recognize(file, "eng");
    return String(r.data.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
  }
  async function handleExcel(file, w, q) {
    var buf = await file.arrayBuffer(), wb = XLSX.read(buf, { type: "array", cellFormula: false });
    var r = CSAExcel.check(wb);
    var L = I.detect(q, S.lang);
    var t = T("excelHead", { f: file.name, n: r.sheets.length, s: r.sheets.slice(0, 6).join(", ") + (r.sheets.length > 6 ? "…" : "") }, L) + "\n\n";
    if (r.findings.length) {
      t += T("excelFound", { n: r.findings.length }, L) + "\n\n" + T("excelCols", null, L) + "\n|---|---|---|---|\n" +
        r.findings.slice(0, 40).map(function (f) { return "| " + (f.sev === "error" ? T("lvErr", null, L) : T("lvWarn", null, L)) + " | " + f.sheet + " | " + f.addr + " | " + f.msg + " |"; }).join("\n");
      if (r.findings.length > 40) t += "\n\n" + T("more", { n: r.findings.length - 40 }, L);
    } else t += T("excelOk", null, L);
    w.parentNode.remove();
    if (q && S.cfg.provider) {
      var out = await CSALLM.ask(S.cfg, { lang: L, question: q + "\n\nTóm tắt dữ liệu file Excel:\n" + r.summary + "\n\nKết quả kiểm tra tự động:\n" + r.findings.slice(0, 30).map(function (f) { return f.sheet + "!" + f.addr + ": " + f.msg; }).join("\n"), history: S.hist, snippets: S.eng.search(q, 3).map(function (h) { return h.e; }), notes: S.notes.map(function (n) { return n.text; }) });
      t += "\n\n---\n" + out.text;
    }
    answerBox({ src: q && S.cfg.provider ? "ai" : "kb", title: T("excelTitle", null, L), text: t, q: q || file.name, lang: L });
  }
  async function handleDxfChat(file, w) {
    var txt = await file.text(); var dx = CSADXF.parse(txt), r = CSACheck.check(dx, {});
    w.parentNode.remove();
    var top = r.issues.filter(function (i) { return i.sev === "error"; }).slice(0, 8).map(function (i) { return "- " + i.msg; }).join("\n");
    var L = S.qlang || S.lang;
    answerBox({ src: "kb", title: T("dxfTitle", null, L), text: T("dxfMsg", { f: file.name, n: r.N, e: r.stat.error, w: r.stat.warn }, L) + "\n\n" + (top || T("dxfNone", null, L)) + "\n\n" + T("dxfOpen", null, L), q: file.name, lang: L });
    loadCheck(file.name, dx, r);
  }

  // ---------------- KIỂM TRA BẢN VẼ ----------------
  var CK = { dx: null, res: null, name: "", filter: null };
  dropper($("#cdrop"), $("#cfile"), function (f) { f.text().then(function (t) { try { CK.dx = CSADXF.parse(t); CK.name = f.name; $("#cdrop").textContent = "✓ " + f.name; $("#crun").disabled = false; } catch (e) { alert("Không đọc được DXF: " + e.message); } }); });
  $("#crun").onclick = function () { var N = +$("#cN").value || 0; var r = CSACheck.check(CK.dx, { N: N || undefined }); loadCheck(CK.name, CK.dx, r); };
  function loadCheck(name, dx, r) {
    CK.dx = dx; CK.res = r; CK.name = name; CK.filter = null;
    $("#cres").classList.remove("hidden"); $("#cfn").textContent = name;
    $("#cinfo").textContent = "Tỷ lệ 1:" + r.N + " · " + r.counts.entities + " đối tượng · " + r.counts.axesX + "×" + r.counts.axesY + " trục · " + r.counts.beams + " nhãn dầm · " + r.counts.columns + " cột · " + r.counts.openings + " lỗ mở";
    var lv = T("lvl"); $("#cstat").innerHTML = "<span class='st e' data-s='error'><b>" + r.stat.error + "</b>" + lv[0] + "</span><span class='st w' data-s='warn'><b>" + r.stat.warn + "</b>" + lv[1] + "</span><span class='st i' data-s='info'><b>" + r.stat.info + "</b>" + lv[2] + "</span>";
    $$("#cstat .st").forEach(function (s) { s.onclick = function () { CK.filter = CK.filter === s.dataset.s ? null : s.dataset.s; $$("#cstat .st").forEach(function (x) { x.classList.toggle("on", x.dataset.s === CK.filter); }); listIssues(); }; });
    listIssues();
    var svg = CSARender.fromEnts(r.ents, dx.layers, r.issues);
    mountSvg($("#cprev"), svg);
    $("#caibox").classList.add("hidden");
  }
  function listIssues() {
    var r = CK.res, arr = r.issues.filter(function (i) { return !CK.filter || i.sev === CK.filter; });
    $("#clist").innerHTML = arr.map(function (i) { return "<div class='iss' data-no='" + i.no + "'><span class='dot " + i.sev + "'></span><span class='n'>#" + i.no + "</span><span>" + esc(i.msg) + "</span></div>"; }).join("") || "<div class='iss'>" + T("noIssue") + "</div>";
    $$("#clist .iss[data-no]").forEach(function (d) { d.onclick = function () { var it = r.issues[+d.dataset.no - 1]; if (it && it.x != null && !isNaN(it.x)) zoomTo($("#cprev"), it.x, it.y); }; });
  }
  $("#clisp").onclick = function () { download("CSA_CHECK.lsp", CSACheck.toLisp(CK.res)); };
  $("#ccsv").onclick = function () {
    var rows = [["STT", "Muc", "Ma", "Noi dung", "X", "Y"]].concat(CK.res.issues.map(function (i) { return [i.no, i.sev, i.code, i.msg, i.x == null ? "" : i.x.toFixed(1), i.y == null ? "" : i.y.toFixed(1)]; }));
    download("CSA_CHECK_" + CK.name.replace(/\.dxf$/i, "") + ".csv", "\ufeff" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n"), "text/csv");
  };
  $("#cai").onclick = async function () {
    if (!S.cfg.provider) { alert("Cần kết nối AI (mục Kết nối AI) để nhận xét thêm."); return; }
    var r = CK.res; $("#caibox").classList.remove("hidden"); $("#caiout").innerHTML = "<span class='typing'><i></i><i></i><i></i></span>";
    var layers = Object.keys(r.layersUsed).map(function (k) { return k + "(" + r.layersUsed[k] + ")"; }).join(", ");
    var q = "Đây là kết quả kiểm tra tự động một bản vẽ mặt bằng kết cấu (tỷ lệ 1:" + r.N + "). Thống kê: " + JSON.stringify(r.counts) + ". Layer dùng: " + layers + ".\nDanh sách lỗi:\n" +
      r.issues.slice(0, 60).map(function (i) { return "#" + i.no + " [" + i.sev + "] " + i.msg; }).join("\n") +
      "\n\nHãy: (1) xếp ưu tiên sửa theo mức ảnh hưởng tới hồ sơ phát hành, (2) chỉ ra lỗi có thể là hệ thống (lặp lại), (3) nêu thêm các điểm kỹ sư nên tự rà mà tool tự động không kiểm được (vd gối dầm, dầm phụ đỡ tường, cao độ sàn WC/ban công, phối hợp mặt cắt), (4) ngắn gọn, đánh số.";
    try { var out = await CSALLM.ask(S.cfg, { question: q, snippets: S.eng.search("quy tắc layer chữ dim tiết diện dầm", 3).map(function (h) { return h.e; }) }); $("#caiout").innerHTML = md(out.text); }
    catch (e) { $("#caiout").innerHTML = md("Lỗi: " + esc(e.message)); }
  };

  // ---------------- DỰNG MBKC ----------------
  var BD = { dx: null, sum: null, res: null, name: "" };
  var ROLES = [["axis", "Trục"], ["axisText", "Chữ trục"], ["col", "Cột"], ["wall", "Tường"], ["open", "Lỗ mở / thang"]];
  dropper($("#bdrop"), $("#bfile"), function (f) {
    f.text().then(function (t) {
      try { BD.dx = CSADXF.parse(t); BD.name = f.name; BD.sum = CSABuild.layerSummary(BD.dx); } catch (e) { alert("Không đọc được DXF: " + e.message); return; }
      $("#bdrop").textContent = "✓ " + f.name; $("#bcfg").classList.remove("hidden"); $("#bres").classList.add("hidden");
      var g = BD.sum.guess;
      var head = "<tr><th>Layer</th><th>Đối tượng</th>" + ROLES.map(function (r) { return "<th class='c'>" + r[1] + "</th>"; }).join("") + "</tr>";
      $("#bmap").innerHTML = head + BD.sum.layers.map(function (l) {
        var info = [l.LINE ? l.LINE + " line" : "", l.PLINE ? l.PLINE + " pline" + (l.CLOSED ? " (" + l.CLOSED + " kín)" : "") : "", l.TEXT ? l.TEXT + " chữ" : "", l.CIRCLE ? l.CIRCLE + " tròn" : "", l.HATCH ? l.HATCH + " hatch" : ""].filter(Boolean).join(", ");
        return "<tr><td><b>" + esc(l.name) + "</b>" + (l.samples.length ? "<div class='sm'>" + esc(l.samples.join(" · ").slice(0, 60)) + "</div>" : "") + "</td><td class='sm'>" + info + "</td>" +
          ROLES.map(function (r) { var on = (g[r[0]] || []).indexOf(l.name) >= 0 && !(r[0] === "axis" && l.LINE === 0); return "<td class='c'><input type='checkbox' data-role='" + r[0] + "' data-l='" + esc(l.name) + "'" + (on ? " checked" : "") + "></td>"; }).join("") + "</tr>";
      }).join("");
    });
  });
  $("#brun").onclick = function () {
    $("#berr").textContent = "";
    var layers = { axis: [], axisText: [], col: [], wall: [], open: [] };
    $$("#bmap input[type=checkbox]:checked").forEach(function (c) { layers[c.dataset.role].push(c.dataset.l); });
    var paper = ($("input[name=bp]:checked") || {}).value, pl = ($("input[name=bpl]:checked") || {}).value;
    if (!layers.axis.length || !layers.col.length) { $("#berr").textContent = "Chọn ít nhất layer Trục và Cột."; return; }
    if (!paper) { $("#berr").textContent = "Chọn khổ giấy A3/A2/A1 (quy tắc không cho mặc định)."; return; }
    if (!$("#bel").value || !$("#bth").value) { $("#berr").textContent = "Nhập cao độ và chiều dày sàn."; return; }
    if (pl == null) { $("#berr").textContent = "Xác nhận lớp trát (có/không hiệu chỉnh) trước khi dựng."; return; }
    var opt = { layers: layers, paper: paper, N: +$("#bN").value || null, floor: $("#bfl").value.trim() || "2", finishElev: +String($("#bel").value).replace(",", "."), elevIsStructural: ($("input[name=bet]:checked") || {}).value === "struct",
      slabT: +$("#bth").value, plaster: pl === "1" ? +$("#bplv").value || 0 : 0, wallMin: +$("#bwmin").value || 90, wallMax: +$("#bwmax").value || 300, title: $("#btitle").value.trim(), sheetNo: $("#bno").value.trim() || "KC-1", hatchCols: $("#bhc").checked };
    try { BD.res = CSABuild.build(BD.dx, opt); } catch (e) { $("#berr").textContent = e.message; return; }
    var r = BD.res; $("#bres").classList.remove("hidden");
    var LD = {}; CSACheck && Object.keys(CSACheck.OFFICIAL).forEach(function (k) { var o = CSACheck.OFFICIAL[k]; LD[k] = { color: o.c || 7, lt: o.lt || "" }; });
    BD.svg = CSARender.fromBuild(r, LD); mountSvg($("#bprev"), BD.svg);
    $("#bnotes").innerHTML = r.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("");
    $("#bask").innerHTML = r.ask.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("");
    $("#btab").innerHTML = "<tr><th>Tên</th><th>Phương</th><th>Vị trí</th><th>Nhịp (m) – tiết diện</th><th>Loại</th></tr>" + r.lines.map(function (l) {
      return "<tr><td><b>" + esc(l.name) + "</b></td><td>" + l.d + "</td><td>" + (l.d === "X" ? "y=" : "x=") + Math.round(l.c) + "</td><td>" + l.spans.map(function (s) { return (s.L / 1000).toFixed(2) + " – " + s.bw / 10 + "X" + s.h / 10; }).join(" | ") + "</td><td>" + ({ main: "chính", wall: "đỡ tường", open: "bao lỗ" }[l.spans[0].kind]) + "</td></tr>";
    }).join("");
    $("#bres").scrollIntoView({ behavior: "smooth" });
  };
  $("#blisp").onclick = function () { download("CSA_MBKC_" + BD.name.replace(/\.dxf$/i, "") + ".lsp", CSABuild.toLisp(BD.res)); };
  $("#bsvg").onclick = function () { download("CSA_MBKC_preview.svg", BD.svg, "image/svg+xml"); };

  // ---------------- preview pan/zoom ----------------
  function mountSvg(box, svgText) {
    $$("#" + box.id + " svg").forEach(function (s) { s.remove(); });
    box.insertAdjacentHTML("afterbegin", svgText);
    var svg = box.querySelector("svg"); var vb0 = svg.getAttribute("viewBox").split(" ").map(Number); box._vb0 = vb0.slice(); box._vb = vb0.slice();
    function set() { svg.setAttribute("viewBox", box._vb.join(" ")); }
    svg.addEventListener("wheel", function (e) {
      e.preventDefault(); var r = svg.getBoundingClientRect(), k = e.deltaY > 0 ? 1.2 : 1 / 1.2, vb = box._vb;
      var px = vb[0] + (e.clientX - r.left) / r.width * vb[2], py = vb[1] + (e.clientY - r.top) / r.height * vb[3];
      box._vb = [px - (px - vb[0]) * k, py - (py - vb[1]) * k, vb[2] * k, vb[3] * k]; set();
    }, { passive: false });
    var drag = null;
    svg.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, vb: box._vb.slice() }; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener("pointermove", function (e) { if (!drag) return; var r = svg.getBoundingClientRect(); box._vb = [drag.vb[0] - (e.clientX - drag.x) / r.width * drag.vb[2], drag.vb[1] - (e.clientY - drag.y) / r.height * drag.vb[3], drag.vb[2], drag.vb[3]]; set(); });
    svg.addEventListener("pointerup", function () { drag = null; });
    box.querySelectorAll(".zb button").forEach(function (b) {
      b.onclick = function () { var z = +b.dataset.z, vb = box._vb; if (!z) box._vb = box._vb0.slice(); else { var cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2; box._vb = [cx - vb[2] / z / 2, cy - vb[3] / z / 2, vb[2] / z, vb[3] / z]; } set(); };
    });
  }
  function zoomTo(box, x, y) {
    var svg = box.querySelector("svg"); if (!svg) return; var w = box._vb0[2] / 6, h = box._vb0[3] / 6;
    box._vb = [x - w / 2, -y - h / 2, w, h]; svg.setAttribute("viewBox", box._vb.join(" "));
    svg.querySelectorAll(".mk").forEach(function (m) { m.style.opacity = 0.35; });
  }
  function dropper(zone, input, cb) {
    zone.onclick = function () { input.click(); };
    input.onchange = function () { if (input.files[0]) cb(input.files[0]); input.value = ""; };
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("on"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("on"); });
    zone.addEventListener("drop", function (e) { e.preventDefault(); zone.classList.remove("on"); if (e.dataTransfer.files[0]) cb(e.dataTransfer.files[0]); });
  }

  // ---------------- LƯU Ý ----------------
  function renderNotes() {
    $("#nlist").innerHTML = S.notes.map(function (n, i) { return "<li>" + esc(n.text) + " <button class='btn sm' data-i='" + i + "'>" + T("del") + "</button></li>"; }).join("") || "<li class='tip'>" + T("noNotes") + "</li>";
    $$("#nlist button").forEach(function (b) { b.onclick = function () { var n = S.notes[+b.dataset.i]; if (n.row) api("ai_note_del", { row: n.row }).catch(function () {}); S.notes.splice(+b.dataset.i, 1); if (FREE) ls("csa_ai_notes", S.notes); renderNotes(); }; });
    $("#glist").innerHTML = S.gnotes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") || "<li class='tip'>" + T("noG") + "</li>";
  }
  $("#nadd").onclick = function () {
    var t = $("#nin").value.trim(); if (!t) return;
    if (FREE) { addNote(t); $("#nin").value = ""; renderNotes(); return; }
    api("ai_note", { note: t }).then(function (r) { S.notes.push({ row: r.row, text: t }); $("#nin").value = ""; renderNotes(); }).catch(function (e) { alert(msg(e.message)); });
  };

  // ---------------- CÀI ĐẶT AI ----------------
  function fillCfg() {
    $("#sprov").value = S.cfg.provider || ""; ["gemini", "claude", "openai"].forEach(function (p) { $("#k" + p).value = S.cfg.keys[p] || ""; $("#m" + p).value = S.cfg.models[p] || ""; });
    $("#sweb").checked = !!S.cfg.web; $("#socr").checked = S.cfg.ocr !== false;
  }
  fillCfg();
  $("#ssave").onclick = function () {
    S.cfg.provider = $("#sprov").value; ["gemini", "claude", "openai"].forEach(function (p) { S.cfg.keys[p] = $("#k" + p).value.trim(); S.cfg.models[p] = $("#m" + p).value.trim(); });
    S.cfg.web = $("#sweb").checked; S.cfg.ocr = $("#socr").checked; ls("csa_ai_cfg", S.cfg); refreshMode();
    $("#smsg").textContent = (S.cfg.provider && !S.cfg.keys[S.cfg.provider]) ? T("noKey") : T("saved");
  };
  $("#stest").onclick = async function () {
    $("#ssave").click(); if (!S.cfg.provider) return; $("#smsg").textContent = T("testing");
    try { var r = await CSALLM.ask(S.cfg, { question: "Trả lời đúng 1 câu: kết nối thành công." }); $("#smsg").textContent = "✓ " + r.text.slice(0, 80); }
    catch (e) { $("#smsg").textContent = "✗ " + e.message; }
  };

  // ---------------- khởi động ----------------
  $("#blang").onclick = function () { setLang(S.lang === "en" ? "vi" : "en"); };
  $("#llang").onclick = function () { setLang(S.lang === "en" ? "vi" : "en"); $("#llang").textContent = S.lang === "en" ? "Tiếng Việt" : "English"; };
  var siteLang = null; try { siteLang = localStorage.getItem("csa-language"); } catch (e) {}
  setLang(ls("csa_ai_lang") || (siteLang === "en" || siteLang === "vi" ? siteLang : null) || ((navigator.language || "vi").indexOf("vi") === 0 ? "vi" : "en"));
  // đồng bộ ngôn ngữ khi CSA AI được nhúng trong website CSA Tools
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || !ev.data || (ev.data.csaLang !== "en" && ev.data.csaLang !== "vi")) return;
    if (ev.data.csaLang !== S.lang) { setLang(ev.data.csaLang); $("#llang").textContent = S.lang === "en" ? "Tiếng Việt" : "English"; }
  });
  if (window.self !== window.top) document.documentElement.classList.add("embed");
  $("#llang").textContent = S.lang === "en" ? "Tiếng Việt" : "English";
  var saved = ls("csa_ai_sess");
  if (DEMO) { S.sess = { user: "demo@csa", sid: "demo", token: "demo", expiry: "", license: "DEMO" }; enter(); }
  else if (FREE) { enterFree(); }
  else if (saved) { S.sess = saved; enter().catch(function (e) { logout(e.message ? msg(e.message) : ""); }); }
})();
