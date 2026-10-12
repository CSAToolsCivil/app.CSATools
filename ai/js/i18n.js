/* CSA AI – song ngữ Việt / English */
(function (root) {
  "use strict";
  var UI_EN = {
    "Trợ lý thông minh của CSA Tools": "Smart assistant for CSA Tools", "Tên đăng nhập (email)": "Username (email)", "Mật khẩu": "Password", "Đăng nhập": "Log in",
    "Dùng chung tài khoản bản quyền CSA Tools. Mỗi tài khoản chỉ đăng nhập 1 nơi.": "Use your CSA Tools license account. Each account can be signed in at one place only.",
    "Chưa có tài khoản?": "No account yet?", "Đăng ký trên website": "Register on the website", "· Hỗ trợ Zalo": "· Zalo support",
    "trợ lý CSA Tools": "CSA Tools assistant", "Đăng xuất": "Log out", "Hỏi đáp": "Ask", "Kiểm tra bản vẽ": "Drawing check", "Dựng MBKC": "Structural plan",
    "Lưu ý của tôi": "My notes", "Kết nối AI": "AI connection", "Chào anh/chị 👋": "Hello 👋",
    "Hỏi gì về CSA Tools cũng được: cài đặt, đăng nhập, cách dùng file tính Excel, tool vẽ AutoCAD, lỗi thường gặp… Có thể dán": "Ask anything about CSA Tools: installation, login, the Excel design files, AutoCAD drawing tools, common errors… You can paste an",
    "ảnh chụp lỗi": "error screenshot", ", gửi file": ", or send an", "để kiểm tra dữ liệu nhập.": "file to check the input data.",
    "Kho CSA (không tốn token)": "CSA knowledge base (no tokens)", "Gõ": "Type", "“lưu ý: …”": "“note: …”", "để nhắn CSA AI ghi nhớ.": "to make CSA AI remember something.",
    "Kiểm tra bản vẽ kết cấu": "Structural drawing check", "Tải file": "Upload a",
    "(AutoCAD: SAVEAS → DXF). Kiểm tra layer, chữ, DIM, trục, nhãn dầm, ký hiệu cột/lỗ mở/sàn, khung tên theo quy tắc MBKC. File chỉ xử lý trên máy anh/chị, không gửi lên mạng.": "file (AutoCAD: SAVEAS → DXF). Checks layers, text, DIMs, grids, beam labels, column/opening/slab symbols and title block against the structural drafting rules. The file is processed on your computer only, never uploaded.",
    "Kéo thả hoặc bấm để chọn file DXF": "Drag & drop or click to choose a DXF file", "Tỷ lệ 1:N": "Scale 1:N", "Kiểm tra": "Check",
    "⬇ LISP đánh dấu lỗi": "⬇ Error-marker LISP", "⬇ Báo cáo CSV": "⬇ CSV report", "Nhờ AI nhận xét thêm": "Ask AI for more comments",
    "Trong AutoCAD:": "In AutoCAD:", "file LISP → gõ": "the LISP file → type", "để vẽ vòng đánh dấu + số thứ tự lỗi (layer CSA_CHECK, không in). Xoá:": "to draw numbered error markers (layer CSA_CHECK, non-plot). Remove:",
    "Nhận xét của AI": "AI comments", "Dựng mặt bằng kết cấu từ mặt bằng kiến trúc": "Structural plan from architectural plan", "Tải mặt bằng kiến trúc": "Upload the architectural plan",
    "→ chọn layer trục, cột, tường, lỗ mở → CSA AI tạo file": "→ choose grid, column, wall, opening layers → CSA AI creates a",
    "vẽ MBKC trong AutoCAD theo quy tắc: kế thừa trục/cột, dầm chính nối cột, dầm đỡ tường, dầm bao lỗ > 2 m², tiết diện sơ bộ, đặt tên dầm, DIM 4 phía, ký hiệu sàn, khung giấy.": "file that draws the structural plan in AutoCAD by the rules: inherited grids/columns, main beams between columns, beams under walls, beams around openings > 2 m², preliminary sizes, beam names, DIMs on 4 sides, slab symbols, paper frame.",
    "Kéo thả hoặc bấm để chọn file DXF kiến trúc": "Drag & drop or click to choose the architectural DXF", "1. Chọn layer": "1. Choose layers",
    "Đã tự gợi ý theo tên layer – kiểm tra lại.": "Suggested from layer names – please review.", "2. Thông số (bắt buộc xác nhận)": "2. Parameters (must confirm)",
    "Khổ giấy *": "Paper size *", "Quy tắc: phải chọn trước, không mặc định A3.": "Rule: must be chosen, no A3 default.", "Tầng (dùng đặt tên D…)": "Floor (for D… names)",
    "Cao độ (m) *": "Level (m) *", "là cao độ hoàn thiện (tự trừ 0.050)": "is the finished level (−0.050 applied)", "là cao độ kết cấu": "is the structural level",
    "Chiều dày sàn (mm) *": "Slab thickness (mm) *", "Lớp trát *": "Plaster *", "Kiến trúc không thể hiện / không hiệu chỉnh": "Not shown / no adjustment", "Có hiệu chỉnh": "Adjust",
    "Tường nhận diện (mm)": "Wall detection (mm)", "khoảng cách 2 nét tường": "distance between the 2 wall lines", "Tên bản vẽ": "Drawing title", "Số bản vẽ": "Drawing no.",
    "Hatch cột": "Column hatch", "Hatch mặt cắt cột (KCS_HATCH)": "Hatch cut columns (KCS_HATCH)", "Kết quả": "Result", "⬇ Tải LISP (CSA_MBKC)": "⬇ Download LISP (CSA_MBKC)", "⬇ Ảnh preview": "⬇ Preview image",
    "AutoCAD: mở bản vẽ (có thể chính file kiến trúc) →": "AutoCAD: open a drawing (can be the architectural file) →", "chọn file LISP → gõ": "load the LISP file → type",
    ". MBKC vẽ đúng toạ độ kiến trúc, đúng 15 layer KCS, style Arial 0.7, DIM 2.2-N, LTSCALE = 10N.": ". The plan is drawn at the architectural coordinates with the 15 KCS layers, Arial 0.7, DIM 2.2-N, LTSCALE = 10N.",
    "Giả thiết đã áp dụng": "Assumptions applied", "Cần kỹ sư xác nhận": "Needs engineer confirmation", "Bảng dầm": "Beam table",
    "CSA AI sẽ tôn trọng các lưu ý này khi trả lời (vd: “tôi dùng ETABS 21”, “công ty dùng TCVN 5574-2018”, “khung tên A2”). Lưu ý cũng được gửi Admin để cải thiện hướng dẫn chung.": "CSA AI follows these notes when answering (e.g. “I use ETABS 21”, “our company uses TCVN 5574-2018”, “A2 title block”). Notes are also sent to the Admin to improve the guides.",
    "Lưu": "Save", "Lưu ý chung của CSA": "CSA general notes", "Kết nối AI của riêng anh/chị (tuỳ chọn)": "Connect your own AI (optional)",
    "Câu hỏi về CSA Tools được trả lời từ kho CSA –": "CSA Tools questions are answered from the CSA knowledge base –", "không tốn token": "no tokens used",
    ". Chỉ khi kho chưa có câu trả lời, hoặc cần phân tích ảnh / tra Google, CSA AI mới gọi AI bằng API key của anh/chị. Key chỉ lưu trong trình duyệt này, không gửi về máy chủ CSA.": ". Only when the base has no answer, or for image analysis / Google search, CSA AI calls an AI with your API key. The key is stored in this browser only, never sent to the CSA server.",
    "Dùng AI": "AI provider", "Không dùng (chỉ kho CSA)": "None (CSA base only)", "Lấy tại aistudio.google.com → Get API key (có gói miễn phí)": "Get it at aistudio.google.com → Get API key (free tier available)",
    "Tra Google mặc định": "Web search by default", "Bật tra cứu web cho câu hỏi ngoài CSA": "Search the web for non-CSA questions", "Đọc chữ trong ảnh": "Read text in images",
    "Dùng OCR miễn phí khi không có AI": "Use free OCR when no AI is connected", "Thử kết nối": "Test connection",
    "Đổi giao diện sáng/tối": "Toggle light/dark", "Đính kèm ảnh / Excel / DXF": "Attach image / Excel / DXF", "Nhập câu hỏi… (Enter để gửi, Shift+Enter xuống dòng)": "Type a question… (Enter to send, Shift+Enter for a new line)",
    "Tra Google (cần API key AI)": "Web search (needs an AI API key)", "Gửi": "Send", "tự nhận": "auto", "tự chọn (bội số 5)": "auto (multiple of 5)", "vd 3.600": "e.g. 3.600",
    "nhập theo hồ sơ": "per drawings", "mm / phía": "mm / side", "MẶT BẰNG KẾT CẤU SÀN TẦNG 2": "MẶT BẰNG KẾT CẤU SÀN TẦNG 2", "Thêm lưu ý…": "Add a note…"
  };
  var BOT = {
    secret: ["Phần mã nguồn, thuật toán và cơ chế bản quyền của CSA Tools được bảo mật nên CSA AI không chia sẻ được ạ. Anh/chị cần hỗ trợ cách **sử dụng** hay **xử lý lỗi** thì cứ hỏi nhé – hoặc liên hệ Admin qua Zalo {phone}.",
      "CSA Tools' source code, algorithms and licensing mechanism are confidential, so CSA AI can't share them. Ask me anything about **using** the tools or **fixing errors** – or contact the Admin on Zalo {phone}."],
    noteSaved: ["Đã ghi nhớ: *{note}*. Mình sẽ áp dụng lưu ý này trong các câu trả lời sau, và đã chuyển cho Admin tham khảo.", "Noted: *{note}*. I'll apply it in future answers and have shared it with the Admin."],
    noteFail: ["Chưa lưu được lưu ý ({err}).", "Couldn't save the note ({err})."],
    ocr: ["Đang đọc chữ trong ảnh…", "Reading text in the image…"],
    ocrSeen: ["Mình đọc được trong ảnh: *“{t}”*", "Text read from the image: *“{t}”*"],
    unknown: ["Câu này mình **chưa có câu trả lời chắc chắn** trong kho CSA. Mình đã chuyển câu hỏi cho Admin để bổ sung – lần sau CSA AI sẽ trả lời được.", "I **don't have a reliable answer** for this in the CSA knowledge base yet. I've forwarded your question to the Admin – CSA AI will be able to answer it next time."],
    unknownRel: ["Có thể anh/chị đang tìm các mục bên dưới 👇", "You may be looking for one of these 👇"],
    unknownHelp: ["Nếu cần gấp: Zalo hỗ trợ {phone}, hoặc vào **Kết nối AI** để gắn Gemini/Claude/ChatGPT trả lời các câu ngoài phạm vi CSA.", "Urgent? Zalo support {phone}, or open **AI connection** to plug in Gemini/Claude/ChatGPT for questions beyond CSA."],
    srcKb: ["Kho CSA", "CSA base"], srcAi: ["AI + tài liệu CSA", "AI + CSA docs"], srcNone: ["Chưa có trong kho", "Not in the base yet"],
    useful: ["Hữu ích không?", "Helpful?"], deeper: ["Hỏi AI sâu hơn", "Ask AI for more"], google: ["🔎 Tìm trên Google", "🔎 Search Google"],
    bad: ["Cảm ơn góp ý! Mình đã báo Admin để chỉnh câu trả lời. Anh/chị có thể gõ **“lưu ý: …”** để mô tả đúng trường hợp của mình.", "Thanks for the feedback! The Admin has been notified to improve this answer. You can type **“note: …”** to describe your case."],
    needAiWeb: ["Tra Google cần kết nối AI (Gemini/Claude/ChatGPT) – vào mục **Kết nối AI** để nhập API key.", "Web search needs an AI connection (Gemini/Claude/ChatGPT) – open **AI connection** to enter an API key."],
    err: ["Có lỗi khi xử lý: {err}", "Something went wrong: {err}"], errKey: ["Kiểm tra lại API key ở mục **Kết nối AI**.", "Check your API key under **AI connection**."],
    sources: ["Nguồn", "Sources"], video: ["Video hướng dẫn", "Tutorial video"], imgQ: ["Phân tích ảnh này giúp mình: lỗi gì và cách sửa?", "Please analyse this image: what is the error and how do I fix it?"],
    excelHead: ["Mình đã đọc file **{f}** ({n} sheet: {s}).", "I've read **{f}** ({n} sheets: {s})."],
    excelFound: ["Phát hiện **{n}** điểm cần kiểm tra trong dữ liệu nhập (chi tiết tiếng Việt):", "Found **{n}** input issues to check (details in Vietnamese):"],
    excelOk: ["Không thấy lỗi định dạng ở các sheet CSA mình nhận diện được (CSA Beam Drawing, Column/Wall Drawing, Template ETABS).", "No format issues found in the CSA sheets I recognise (CSA Beam Drawing, Column/Wall Drawing, ETABS template)."],
    excelCols: ["| Mức | Sheet | Ô | Nội dung |", "| Level | Sheet | Cell | Issue |"], lvErr: ["🔴 Lỗi", "🔴 Error"], lvWarn: ["🟠 Lưu ý", "🟠 Warning"],
    more: ["…còn {n} mục.", "…{n} more."], excelTitle: ["Kiểm tra file Excel", "Excel file check"], dxfTitle: ["Kiểm tra bản vẽ", "Drawing check"],
    dxfMsg: ["Bản vẽ **{f}** (tỷ lệ nhận diện 1:{n}): **{e}** lỗi, **{w}** cảnh báo.", "Drawing **{f}** (detected scale 1:{n}): **{e}** errors, **{w}** warnings."],
    dxfNone: ["Không có lỗi nghiêm trọng.", "No critical errors."], dxfOpen: ["Mở mục **Kiểm tra bản vẽ** để xem vị trí từng lỗi và tải file LISP đánh dấu (nội dung lỗi bằng tiếng Việt).", "Open **Drawing check** to see each error's location and download the marker LISP (issue texts are in Vietnamese)."],
    kbinfo: ["Kho CSA: {n} mục", "CSA base: {n} entries"], learned: [" ({n} đã học)", " ({n} learned)"], expiry: ["hạn {d}", "expires {d}"], freeUser: ["Miễn phí cho mọi người", "Free for everyone"],
    modeKb: ["Kho CSA (không tốn token)", "CSA knowledge base (no tokens)"], modeAi: ["Kho CSA → {p}", "CSA base → {p}"],
    noIssue: ["Không có mục nào 🎉", "Nothing here 🎉"], lvl: [["lỗi", "cảnh báo", "ghi chú"], ["errors", "warnings", "notes"]],
    noNotes: ["Chưa có lưu ý.", "No notes yet."], noG: ["Chưa có.", "None yet."], del: ["Xoá", "Delete"],
    saved: ["Đã lưu.", "Saved."], noKey: ["⚠ Chưa nhập key cho AI đã chọn.", "⚠ No key entered for the selected AI."], testing: ["Đang thử…", "Testing…"],
    deepFail: ["Không gọi được AI: {err}", "Couldn't reach the AI: {err}"]
  };
  var QUICK = {
    vi: [["Không đăng nhập được", "Báo SAI_THONG_TIN, chưa duyệt…"], ["Cài tool vẽ vào AutoCAD", "CUILOAD, APPLOAD, CSA_LOAD"], ["Lỗi No Opened ETABS Model", "Mất kết nối API"], ["Excel không chạy macro", "Trust Center"],
      ["Cách tính dầm theo TCVN", "File 01.CSA_Beam Design"], ["Cách vẽ chi tiết dầm", "Sheet CSA Beam Drawing"], ["Model ETABS từ AutoCAD", "Lệnh AAE"], ["Tính sàn theo Design Strips", "Strip Forces / API"]],
    en: [["I can't log in", "SAI_THONG_TIN, not approved…"], ["Load the drawing tools into AutoCAD", "CUILOAD, APPLOAD, CSA_LOAD"], ["No Opened ETABS Model error", "API connection lost"], ["Macros don't run in Excel", "Trust Center"],
      ["How to design a beam", "File 01.CSA_Beam Design"], ["Beam detailing", "CSA Beam Drawing sheet"], ["Model ETABS from AutoCAD", "AAE command"], ["Slab design with Design Strips", "Strip Forces / API"]]
  };
  var MSG_EN = {
    SAI_THONG_TIN: "Wrong username or password.", CHUA_DUOC_DUYET: "Your account has not been approved yet (not paid or not activated). Contact Zalo {phone}.",
    HET_HAN: "Your license has expired – contact the Admin to renew.", KHOA_TAM_15_PHUT: "Too many failed attempts – try again in 15 minutes.",
    DANG_NHAP_NOI_KHAC: "This account just signed in somewhere else – this session has ended (one place per account).", PHIEN_HET_HAN: "Your session has expired, please log in again.",
    THIEU_THONG_TIN: "Enter both username and password.", NETWORK: "Can't reach the CSA server – check your connection and try again.", TIMEOUT: "The server is slow to respond – try again in a few minutes.", KB_FAIL: "Signed in, but the knowledge base could not be loaded from the server – please tell the Admin to check the AI_KB sheet."
  };
  var VI_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  var EN_W = /\b(how|what|why|which|where|when|can|cannot|can't|does|doesn't|do|don't|is|are|the|my|error|install|login|please|should|help|not|work|working|load|design|draw|price|file)\b/gi;
  var VI_W = /\b(khong|duoc|lam|sao|cach|loi|cai|dat|tinh|ve|dam|cot|san|bi|gi|nao|minh|toi|anh|em|nhu|the|vay|gium|giup)\b/gi;
  function detect(text, fallback) {
    var t = String(text || "");
    if (!t.trim()) return fallback;
    if (VI_RE.test(t)) return "vi";
    var en = (t.match(EN_W) || []).length, vi = (t.match(VI_W) || []).length;
    if (en > vi && en >= 1) return "en";
    if (vi > en) return "vi";
    return fallback;
  }
  function T(key, lang, vars) {
    var v = BOT[key]; if (!v) return key;
    var s = v[lang === "en" ? 1 : 0];
    if (typeof s === "string" && vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function applyUI(lang, rootEls) {
    rootEls.forEach(function (rootEl) {
      var w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null), n;
      while ((n = w.nextNode())) {
        if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue;
        if (n._vi === undefined) { var k = n.nodeValue.trim(); if (!k || !UI_EN[k]) continue; n._vi = n.nodeValue; n._key = k; }
        n.nodeValue = lang === "en" ? n._vi.replace(n._key, UI_EN[n._key]) : n._vi;
      }
      rootEl.querySelectorAll("[placeholder],[title]").forEach(function (el) {
        ["placeholder", "title"].forEach(function (a) {
          if (!el.hasAttribute(a)) return;
          var key = "_vi_" + a; if (el[key] === undefined) el[key] = el.getAttribute(a);
          var vi = el[key]; el.setAttribute(a, lang === "en" && UI_EN[vi] ? UI_EN[vi] : vi);
        });
      });
    });
  }
  root.CSAI18N = { T: T, detect: detect, applyUI: applyUI, QUICK: QUICK, MSG_EN: MSG_EN };
})(window);
