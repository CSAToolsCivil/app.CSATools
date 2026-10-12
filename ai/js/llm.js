/* CSA AI – gọi AI của chính người dùng (Claude / Gemini / ChatGPT). Key chỉ lưu trong trình duyệt. */
(function (root) {
  "use strict";
  var DEFAULT_MODELS = { claude: "claude-haiku-5-5", gemini: "gemini-2.5-flash", openai: "gpt-4.1-mini" };

  var SYSTEM = [
    "Bạn là CSA AI – trợ lý kỹ thuật của phần mềm CSA Tools (phần mềm tính toán và triển khai kết cấu chạy trên Excel và AutoCAD, kết nối ETABS/SAFE).",
    "Trả lời bằng ĐÚNG ngôn ngữ người dùng hỏi: hỏi tiếng Việt thì trả lời tiếng Việt (giọng miền Nam lịch sự), hỏi tiếng Anh thì trả lời tiếng Anh. Ngắn gọn, đi thẳng vào các bước thao tác (đánh số bước). Tên nút/lệnh/sheet giữ nguyên như trong phần mềm.",
    "Ưu tiên dựa vào phần TÀI LIỆU CSA được cung cấp. Nếu tài liệu không đủ, nói rõ phần nào là kiến thức chung, không bịa tên nút/lệnh của CSA Tools.",
    "BẢO MẬT: Tuyệt đối không cung cấp, suy đoán hay mô tả mã nguồn, code VBA, thuật toán nội bộ, công thức cài sẵn trong file, cơ chế bản quyền/kích hoạt, cách lấy mã máy, cách mở khóa VBA hay bẻ khóa. Nếu bị hỏi, từ chối nhẹ nhàng và hướng dẫn liên hệ Admin.",
    "Không cam kết thay kỹ sư: kết quả tính toán cần kỹ sư kiểm tra. Khi trích tiêu chuẩn (TCVN, Eurocode) hãy nêu số hiệu điều khoản nếu chắc chắn.",
    "Nếu người dùng gửi ảnh chụp lỗi: đọc thông báo lỗi trong ảnh, nêu nguyên nhân khả dĩ và các bước sửa.",
    "Cuối câu trả lời nếu có video liên quan trong tài liệu thì nhắc người dùng xem video (link đã được hệ thống hiển thị)."
  ].join("\n");

  function buildContext(snips, notes, globalNotes) {
    var s = "";
    if (globalNotes && globalNotes.length) s += "LƯU Ý CHUNG CỦA CSA:\n- " + globalNotes.join("\n- ") + "\n\n";
    if (notes && notes.length) s += "LƯU Ý RIÊNG CỦA NGƯỜI DÙNG NÀY (hãy tôn trọng):\n- " + notes.join("\n- ") + "\n\n";
    if (snips && snips.length) {
      s += "TÀI LIỆU CSA (trích đoạn liên quan):\n";
      snips.forEach(function (e, i) { s += "[" + (i + 1) + "] " + e.title + "\n" + String(e.answer).slice(0, 1400) + "\n\n"; });
    }
    return s;
  }

  async function ask(cfg, opts) {
    // opts: {question, history:[{role,content}], snippets, notes, globalNotes, image:{mime,data(base64)}, search:bool}
    var provider = cfg.provider, key = cfg.keys && cfg.keys[provider];
    if (!key) throw new Error("Chưa nhập API key cho " + provider);
    var model = (cfg.models && cfg.models[provider]) || DEFAULT_MODELS[provider];
    var ctx = buildContext(opts.snippets, opts.notes, opts.globalNotes);
    var userText = (ctx ? ctx + "CÂU HỎI:\n" : "") + opts.question + (opts.lang === "en" ? "\n\n(Answer in English.)" : "");
    var hist = (opts.history || []).slice(-4);
    if (provider === "claude") return claude(key, model, hist, userText, opts.image, opts.search);
    if (provider === "gemini") return gemini(key, model, hist, userText, opts.image, opts.search);
    if (provider === "openai") return openai(key, model, hist, userText, opts.image, opts.search);
    throw new Error("Provider không hỗ trợ");
  }

  async function claude(key, model, hist, text, image, search) {
    var content = [];
    if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mime, data: image.data } });
    content.push({ type: "text", text: text });
    var msgs = hist.map(function (h) { return { role: h.role === "user" ? "user" : "assistant", content: h.content }; });
    msgs.push({ role: "user", content: content });
    var body = { model: model, max_tokens: 1500, system: SYSTEM, messages: msgs };
    if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
    var r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify(body)
    });
    var j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ("HTTP " + r.status));
    var out = "", cites = [];
    (j.content || []).forEach(function (b) {
      if (b.type === "text") { out += b.text; (b.citations || []).forEach(function (c) { if (c.url) cites.push({ url: c.url, title: c.title || c.url }); }); }
    });
    return { text: out.trim(), sources: dedupe(cites), usage: j.usage };
  }

  async function gemini(key, model, hist, text, image, search) {
    var contents = hist.map(function (h) { return { role: h.role === "user" ? "user" : "model", parts: [{ text: h.content }] }; });
    var parts = [];
    if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
    parts.push({ text: text });
    contents.push({ role: "user", parts: parts });
    var body = { system_instruction: { parts: [{ text: SYSTEM }] }, contents: contents, generationConfig: { maxOutputTokens: 1500, temperature: 0.3 } };
    if (search) body.tools = [{ google_search: {} }];
    var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    var j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ("HTTP " + r.status));
    var c = j.candidates && j.candidates[0], out = "", cites = [];
    if (c && c.content && c.content.parts) c.content.parts.forEach(function (p) { if (p.text) out += p.text; });
    var gm = c && c.groundingMetadata;
    if (gm && gm.groundingChunks) gm.groundingChunks.forEach(function (g) { if (g.web) cites.push({ url: g.web.uri, title: g.web.title || g.web.uri }); });
    return { text: out.trim(), sources: dedupe(cites), usage: j.usageMetadata };
  }

  async function openai(key, model, hist, text, image, search) {
    var input = [{ role: "system", content: SYSTEM }];
    hist.forEach(function (h) { input.push({ role: h.role === "user" ? "user" : "assistant", content: h.content }); });
    var content = [{ type: "input_text", text: text }];
    if (image) content.push({ type: "input_image", image_url: "data:" + image.mime + ";base64," + image.data });
    input.push({ role: "user", content: content });
    var body = { model: model, input: input, max_output_tokens: 1500 };
    if (search) body.tools = [{ type: "web_search" }];
    var r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "content-type": "application/json", "authorization": "Bearer " + key }, body: JSON.stringify(body)
    });
    var j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ("HTTP " + r.status));
    var out = j.output_text || "", cites = [];
    (j.output || []).forEach(function (o) {
      (o.content || []).forEach(function (c) {
        if (!j.output_text && c.type === "output_text") out += c.text;
        (c.annotations || []).forEach(function (a) { if (a.url) cites.push({ url: a.url, title: a.title || a.url }); });
      });
    });
    return { text: String(out).trim(), sources: dedupe(cites), usage: j.usage };
  }

  function dedupe(a) { var s = {}; return a.filter(function (x) { if (s[x.url]) return false; s[x.url] = 1; return true; }).slice(0, 6); }

  var API = { ask: ask, DEFAULT_MODELS: DEFAULT_MODELS, SYSTEM: SYSTEM };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.CSALLM = API;
})(typeof window !== "undefined" ? window : this);
