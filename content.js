// content.js (old working code + minimal safe periodic extend-clicker)
// Automatic copying of the temp email to clipboard has been REMOVED.
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

  // === Minimal safe periodic clicker ===
  // Interval in milliseconds (30s by default; change if you want faster)
  const EXTEND_INTERVAL_MS = 30 * 1000;

  function simpleExtendClick(){
    try {
      // prefer exact element if available
      const btn = document.querySelector('#moreMinutes');
      if (btn) {
        try {
          // scroll into view gently then click
          try { btn.scrollIntoView({block: 'center', behavior: 'auto'}); } catch(e){}
          btn.click();
          return true;
        } catch(e){
          // fallback to dispatching events
          try {
            ['mouseover','mousedown','mouseup','click'].forEach(type=>{
              btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            });
            return true;
          } catch(evErr){
            return false;
          }
        }
      } else {
        // fallback to older heuristic
        return tryClickExtendButtonFallback();
      }
    } catch(e){ return false; }
  }

  // Start the minimal loop (one immediate click, then interval)
  try {
    simpleExtendClick();
  } catch(e){}
  const extendTimer = setInterval(() => { try { simpleExtendClick(); } catch(e){} }, EXTEND_INTERVAL_MS);

  // Expose a small control for debugging in console:
  // window.__ETM_extend_control.runOnce()   -> triggers one click
  // window.__ETM_extend_control.stop()      -> stops the interval
  window.__ETM_extend_control = {
    runOnce: function(){ try { simpleExtendClick(); } catch(e){} },
    stop: function(){ try { clearInterval(extendTimer); } catch(e){} }
  };

  window.addEventListener('unload', ()=> { try{ clearInterval(extendTimer); }catch(e){} });

  // === original scanning & UI update logic (unchanged) ===
  const doScanDebounced = ETM.debounce(function(){
    try {
      const e = ETM.scraper.getTempEmail();

      // --- Minimal change: keep original setEmail call, but DO NOT auto-copy to clipboard ---
      try {
        ETM.ui.setEmail(e || '');
        // Automatic clipboard write removed to prevent repeated copying
      } catch(ee) {
        // ignore any errors here so we don't break scanning
      }

      const found = ETM.scraper.scanIframesForDataSrc();
      if (found && (found.text || found.html)) {
        const fields = ETM.scraper.extractFieldsFromHtml(found.html || found.text);
        const incomingBody = (fields.body || found.text || '').trim();
        // pass frameElement so scraper can try to find 'Sender' in surrounding DOM
        const added = ETM.scraper.addMailEntry({ from: fields.from || '', body: incomingBody, html: found.html || '', frameElement: found.frameElement });
        if (added) {
          ETM.ui.renderMailList(ETM.scraper.getAllMails());
        } else {
          // not new; ensure UI list still reflects store
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
