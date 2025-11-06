// content.js
// Orchestrator: initializes UI, periodically scans using scraper, observes mutations and updates UI.
// Keeps everything defensive and debounced.

(function(ETM){
  'use strict';
  // quick guard — only run on target host
  try {
    if (!location.hostname.includes('etempmail.com')) return;
  } catch(e) { return; }

  // init UI
  try { ETM.ui && ETM.ui.init(); } catch(e){}

  // small debounced updater
  const doUpdate = ETM.debounce(function(){
    try {
      // update email
      try {
        const e = ETM.scraper.getTempEmail();
        ETM.ui.setEmail(e || '');
      } catch(e){}

      // scan iframes for message body first
      let found = null;
      try { found = ETM.scraper.scanIframesForDataSrc(); } catch(e){}

      if (found && (found.text || found.html)) {
        // we have html/text — extract fields heuristically
        const fields = ETM.scraper.extractFieldsFromHtml(found.html || found.text);
        ETM.ui.setSubject(fields.subject || '');
        // prefer extracted body, otherwise plain text
        ETM.ui.setBody(fields.body || found.text || '');
      } else {
        // fallback: nothing found
        ETM.ui.setSubject('(no subject found)');
        ETM.ui.setBody('(message preview — not found yet)');
      }
    } catch(err) {
      // swallow
      console.warn('content.doUpdate error', err && err.message);
    }
  }, 180); // 180ms debounce

  // initial update
  try { doUpdate(); } catch(e){}

  // observe top-level changes to detect iframe src updates or replacement
  try {
    const mo = new MutationObserver(function(muts){
      // simple heuristic: if iframe added/removed or iframe src/srcdoc changed -> update
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
      if (should) doUpdate();
    });
    mo.observe(document.documentElement || document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['src','srcdoc']});
    // stop observing on unload
    window.addEventListener('unload', () => { try{ mo.disconnect(); }catch(e){} });
  } catch(e){}

  // also poll occasionally at low frequency as fallback (every 2.5s)
  const periodic = setInterval(() => { try { doUpdate(); } catch(e){} }, 2500);
  window.addEventListener('unload', () => { try{ clearInterval(periodic); }catch(e){} });

})(window.ETM || (window.ETM = {}));
