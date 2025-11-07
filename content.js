// content.js (Final: TempMail created once; SignInLink1/SignInCode1 created only if SignInLink1 missing)
(function(ETM){
  'use strict';
  try { if (!location.hostname.includes('etempmail.com')) return; } catch(e){ return; }

  try { ETM.ui && ETM.ui.init(); } catch(e){}

  (async function initLoad(){
    try {
      if (ETM.scraper && ETM.scraper.loadSavedMails) {
        await ETM.scraper.loadSavedMails();
        try { ETM.ui.renderMailList(ETM.scraper.getAllMails()); } catch(e){}
      }
    } catch(e){}
  })();

  // --- Cookie helpers (NO ENCODING) ---
  function setCookie(name, value, maxAgeSeconds){
    try {
      if (!name) return false;
      const v = String(value || '');
      const max = typeof maxAgeSeconds === 'number' ? `; max-age=${Math.floor(maxAgeSeconds)}` : '';
      document.cookie = `${name}=${v}${max}; path=/; SameSite=Lax`;
      return true;
    } catch(e){ return false; }
  }

  function getCookie(name){
    try {
      const cookies = document.cookie ? document.cookie.split('; ') : [];
      for (const c of cookies){
        const [k, ...rest] = c.split('=');
        if (k === name) return rest.join('=');
      }
      return null;
    } catch(e){ return null; }
  }

  // Extract 6-digit code and sign-in link from mail entry
  function extractLinkAndCodeFromMail(m){
    try {
      let code = null;
      let link = null;
      try {
        const text = (m.html && m.html.length>20) ? (new DOMParser().parseFromString(m.html, 'text/html')).body.innerText || '' : (m.body || '');
        const cm = text && text.match(/\b(\d{6})\b/);
        if (cm) code = cm[1];
      } catch(e){}

      try {
        if (m.html && m.html.length > 10) {
          const d = new DOMParser().parseFromString(m.html, 'text/html');
          const anchors = Array.from(d.querySelectorAll('a[href]'));
          const pref = anchors.find(a=>/perplexity\.ai/i.test(a.getAttribute('href')));
          const first = pref || anchors[0];
          if (first) link = first.getAttribute('href');
        }
        if (!link) {
          const txt = (m.html && m.html.length>20) ? (new DOMParser().parseFromString(m.html,'text/html')).body.innerText : (m.body || '');
          const um = (txt || '').match(/https?:\/\/[^\s"'<>]+/i);
          if (um) link = um[0];
        }
      } catch(e){}
      return { link, code };
    } catch(e){ return { link: null, code: null }; }
  }

  function tryClickExtendButtonFallback(){
    try {
      const cand = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
      for (const el of cand){
        try {
          const txt = (el.textContent || el.value || '').trim();
          if (!txt) continue;
          if (/extend\s*20/i.test(txt) || /extend\s*20\s*min/i.test(txt)) {
            el.click();
            return true;
          }
        } catch(e){}
      }
      const fallback = document.querySelector('[data-action="extend"]') || document.querySelector('.extend-20, .extend-button');
      if (fallback) { try { fallback.click(); return true; } catch(e){} }
    } catch(e){}
    return false;
  }

  const EXTEND_INTERVAL_MS = 30 * 1000;
  function simpleExtendClick(){
    try {
      const btn = document.querySelector('#moreMinutes');
      if (btn) {
        try { btn.scrollIntoView({block: 'center', behavior: 'auto'}); } catch(e){}
        btn.click();
        return true;
      } else {
        return tryClickExtendButtonFallback();
      }
    } catch(e){ return false; }
  }

  try { simpleExtendClick(); } catch(e){}
  const extendTimer = setInterval(() => { try { simpleExtendClick(); } catch(e){} }, EXTEND_INTERVAL_MS);

  window.__ETM_extend_control = {
    runOnce: function(){ try { simpleExtendClick(); } catch(e){} },
    stop: function(){ try { clearInterval(extendTimer); } catch(e){} }
  };
  window.addEventListener('unload', ()=> { try{ clearInterval(extendTimer); }catch(e){} });

  // === scanning & UI update logic (unchanged except cookie writes) ===
  const doScanDebounced = ETM.debounce(function(){
    try {
      const e = ETM.scraper.getTempEmail();

      try {
        ETM.ui.setEmail(e || '');

        // ---------- TempMail cookie: create only once, and not for placeholders ----------
        try {
          const existing = getCookie('TempMail');
          const emailLooksValid = typeof e === 'string' && /\S+@\S+\.\S+/.test(e);
          const isPlaceholder = typeof e === 'string' && /\b(please\s*wait|loading|generat|please\s*wait\.{0,3})\b/i.test(e);
          if (emailLooksValid && !isPlaceholder && !existing) {
            setCookie('TempMail', e, 365*24*60*60);
          }
        } catch(ee){}
      } catch(ee){}

      const found = ETM.scraper.scanIframesForDataSrc();
      if (found && (found.text || found.html)) {
        const fields = ETM.scraper.extractFieldsFromHtml(found.html || found.text);
        const incomingBody = (fields.body || found.text || '').trim();
        const added = ETM.scraper.addMailEntry({ from: fields.from || '', body: incomingBody, html: found.html || '', frameElement: found.frameElement });
        if (added) {
          // Perplexity verification mail → create SignInLink1/SignInCode1 only if SignInLink1 doesn't exist
          try {
            const fromLower = (added.from || '').trim().toLowerCase();
            if (fromLower === 'support@perplexity.ai') {
              // Only create if SignInLink1 not present
              const existingSign = getCookie('SignInLink1');
              if (!existingSign) {
                const { link, code } = extractLinkAndCodeFromMail(added);
                if (link) try { setCookie('SignInLink1', link, 24*60*60); } catch(e){}
                if (code) try { setCookie('SignInCode1', code, 24*60*60); } catch(e){}
              } // else do nothing (do not update/overwrite)
            }
          } catch(e){}
          ETM.ui.renderMailList(ETM.scraper.getAllMails());
        } else {
          ETM.ui.renderMailList(ETM.scraper.getAllMails());
        }
      } else {
        ETM.ui.renderMailList(ETM.scraper.getAllMails());
      }
    } catch(e){ console.warn('scan error', e && e.message); }
  }, 180);

  try { doScanDebounced(); } catch(e){}
  try {
    const mo = new MutationObserver(function(muts){
      let should = false;
      for (const m of muts) {
        if (m.type === 'attributes' && m.target && m.target.tagName === 'IFRAME' &&
            (m.attributeName === 'src' || m.attributeName === 'srcdoc')) { should = true; break; }
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (n.tagName === 'IFRAME') { should = true; break; }
          }
          if (should) break;
        }
      }
      if (should) doScanDebounced();
    });
    mo.observe(document.documentElement || document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['src','srcdoc']});
    window.addEventListener('unload', ()=> { try{ mo.disconnect(); }catch(e){} });
  } catch(e){}

  const periodic = setInterval(()=> { try { doScanDebounced(); } catch(e){} }, 2500);
  window.addEventListener('unload', ()=> { try{ clearInterval(periodic); }catch(e){} });

  window.addEventListener('ETM_FORCE_SCAN', ()=> { try { doScanDebounced(); } catch(e){} });

})(window.ETM = window.ETM || {});
