/* ويدجت الوكيل الذكي — يُركّب في أي موقع:
   <script src="https://YOUR-APP.vercel.app/widget.js" data-company="demo" defer></script> */
(function () {
  var script = document.currentScript || document.querySelector('script[data-company]');
  var slug = script.getAttribute('data-company');
  var api = script.getAttribute('data-api') || new URL(script.src).origin;
  if (!slug) return console.warn('wakeel: data-company مفقود');

  var key = 'wakeel_uid_' + slug, uid;
  try { uid = localStorage.getItem(key); } catch (e) {}
  if (!uid) {
    uid = 'w_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(key, uid); } catch (e) {}
  }

  var color = '#0f766e';
  var host = document.createElement('div');
  host.id = 'wakeel-root';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:"IBM Plex Sans Arabic",Tahoma,system-ui,sans-serif}' +
    '.btn{position:fixed;bottom:20px;left:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:transform .2s}' +
    '.btn:hover{transform:scale(1.07)}' +
    '.panel{position:fixed;bottom:92px;left:20px;width:370px;max-width:calc(100vw - 24px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;z-index:2147483647;direction:rtl}' +
    '.panel.open{display:flex}' +
    '.head{padding:16px;color:#fff;display:flex;align-items:center;gap:10px}' +
    '.head b{font-size:15px;display:block}.head small{opacity:.85;font-size:12px}' +
    '.dot{width:9px;height:9px;border-radius:50%;background:#4ade80;display:inline-block;margin-left:5px}' +
    '.x{margin-right:auto;background:none;border:0;color:#fff;font-size:22px;cursor:pointer}' +
    '.body{flex:1;overflow-y:auto;padding:14px;background:#f6f7f9;display:flex;flex-direction:column;gap:8px}' +
    '.m{max-width:82%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word}' +
    '.bot{background:#fff;color:#1f2937;align-self:flex-start;border-bottom-right-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.06)}' +
    '.me{color:#fff;align-self:flex-end;border-bottom-left-radius:4px}' +
    '.typing{color:#9ca3af;font-size:13px;align-self:flex-start;padding:4px 8px}' +
    '.foot{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}' +
    'textarea{flex:1;resize:none;border:1px solid #e5e7eb;border-radius:12px;padding:10px;font-size:14px;height:44px;outline:none}' +
    'textarea:focus{border-color:#9ca3af}' +
    '.send{border:0;color:#fff;border-radius:12px;padding:0 16px;cursor:pointer;font-size:14px}' +
    '.send:disabled{opacity:.5}' +
    '.brand{text-align:center;font-size:10.5px;color:#9ca3af;padding:0 0 6px;background:#fff}' +
    '</style>' +
    '<button class="btn" aria-label="محادثة"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>' +
    '<div class="panel" role="dialog">' +
    '<div class="head"><div><b class="title">المساعد الذكي</b><small><span class="dot"></span>متصل الآن</small></div><button class="x" aria-label="إغلاق">×</button></div>' +
    '<div class="body"></div>' +
    '<div class="foot"><textarea placeholder="اكتب رسالتك..."></textarea><button class="send">إرسال</button></div>' +
    '<div class="brand">مدعوم بالذكاء الاصطناعي</div>' +
    '</div>';

  var $ = function (s) { return root.querySelector(s); };
  var btn = $('.btn'), panel = $('.panel'), body = $('.body'), input = $('textarea'), send = $('.send');
  var greeted = false, busy = false;

  function paint() {
    btn.style.background = color; $('.head').style.background = color; send.style.background = color;
    root.querySelectorAll('.me').forEach(function (e) { e.style.background = color; });
  }
  function add(text, who) {
    var d = document.createElement('div');
    d.className = 'm ' + who; d.textContent = text;
    if (who === 'me') d.style.background = color;
    body.appendChild(d); body.scrollTop = body.scrollHeight;
    return d;
  }

  var greeting = 'هلا والله! كيف أقدر أخدمك؟';
  fetch(api + '/api/company?slug=' + encodeURIComponent(slug)).then(function (r) { return r.json(); }).then(function (c) {
    if (c.color) color = c.color;
    if (c.name) $('.title').textContent = c.name;
    if (c.greeting) greeting = c.greeting;
    paint();
  }).catch(function () { paint(); });
  paint();

  btn.onclick = function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      if (!greeted) { add(greeting, 'bot'); greeted = true; }
      input.focus();
    }
  };
  $('.x').onclick = function () { panel.classList.remove('open'); };

  function submit() {
    var t = input.value.trim();
    if (!t || busy) return;
    busy = true; send.disabled = true;
    add(t, 'me'); input.value = '';
    var typing = document.createElement('div');
    typing.className = 'typing'; typing.textContent = 'يكتب...';
    body.appendChild(typing); body.scrollTop = body.scrollHeight;
    fetch(api + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: slug, userKey: uid, text: t })
    }).then(function (r) { return r.json(); }).then(function (d) {
      typing.remove(); add(d.reply || d.error || 'صار خلل، جرّب مرة ثانية', 'bot');
    }).catch(function () {
      typing.remove(); add('تعذّر الاتصال، تأكد من الإنترنت وجرّب مرة ثانية', 'bot');
    }).finally(function () { busy = false; send.disabled = false; input.focus(); });
  }
  send.onclick = submit;
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
})();
