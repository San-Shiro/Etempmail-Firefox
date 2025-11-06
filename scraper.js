// scraper.js (updated sender extraction: checks surrounding DOM innerHTML + iframe html)
window.ETM = window.ETM || {};
(function(ns, utils){
  function safeQuery(selector){ try { return document.querySelector(selector); } catch(e){ return null; } }

  function getTempEmail(){
    try {
      const input = safeQuery('#tempEmailAddress');
      if (input && (input.value||'').trim()) return input.value.trim();
      const alt = safeQuery('input[name="email"], input[type="email"]');
      if (alt && (alt.value||'').trim()) return alt.value.trim();
      const any = Array.from(document.querySelectorAll('[id*="email"], [class*="email"]'))
                    .map(n => (n.value||n.textContent||'')).find(Boolean);
      if (any) return String(any).trim();
      return '';
    } catch(e) { return ''; }
  }

  function scanIframesForDataSrc(){
    try {
      const frames = Array.from(document.querySelectorAll('iframe'));
      for (let i=0;i<frames.length;i++){
        const f = frames[i];
        try {
          const raw = f.getAttribute('src') || f.src || '';
          if (raw && raw.startsWith('data:')) {
            const html = utils.decodeDataUri(raw);
            const text = utils.parseHtmlToText(html);
            if (text && text.length>0) return {index:i, html, text, frameElement: f};
            if (html) return {index:i, html, text: '', frameElement: f};
          }
          try{
            const doc = f.contentDocument;
            if (doc && doc.body) {
              const t = (doc.body.innerText||doc.body.textContent||'').trim();
              if (t) return {index:i, html: doc.documentElement.outerHTML, text: t, frameElement: f};
            }
          }catch(e){}
        } catch(e){}
      }
    } catch(e){}
    return null;
  }

  function extractFieldsFromHtml(html){
    const out = { subject: '', from: '', body: '' };
    try {
      if (!html) return out;
      const dp = new DOMParser();
      const doc = dp.parseFromString(html, 'text/html');

      // subject
      const title = (doc.querySelector('title') && doc.querySelector('title').textContent) || '';
      if (title) out.subject = title.trim();
      const headText = Array.from(doc.querySelectorAll('h1,h2,h3,strong,b')).map(n=>n.textContent||'').join(' | ');
      if (!out.subject && headText) out.subject = headText.split('|')[0].trim();

      // body
      const bodyText = (doc.body && (doc.body.innerText||doc.body.textContent) || '').trim();
      out.body = bodyText;

      // from heuristics: look for explicit "Sender" label in innerHTML (handles your snippet)
      try {
        // find elements containing "Sender" text in the parsed doc
        const cand = Array.from(doc.querySelectorAll('*')).find(n => {
          try {
            const t = n.textContent || '';
            return /\bSender\b\s*:|From\b\s*:|From\b/.test(t);
          } catch(e){ return false; }
        });
        if (cand) {
          // try to extract an email from this candidate element's innerHTML (to capture <a href="mailto:...">)
          const inner = cand.innerHTML || cand.textContent || '';
          let em = (inner.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/) || [null])[0];
          if (em) out.from = em;
          else {
            // also try mailto link
            const maila = cand.querySelector && cand.querySelector('a[href^="mailto:"]');
            if (maila) {
              const href = maila.getAttribute('href') || '';
              const em2 = href.replace(/^mailto:/i,'').split('?')[0];
              if (em2) out.from = em2;
            }
          }
        }
      } catch(e){}

      // fallback: any email in body
      if (!out.from) {
        const emailAny = bodyText.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
        if (emailAny) out.from = emailAny[0];
      }

      return out;
    } catch(e){
      return out;
    }
  }

  // NEW: find sender from page DOM near the iframe element (checks innerHTML of ancestor nodes)
  function findSenderNearFrameElement(frameEl){
    try {
      if (!frameEl) return '';
      // climb up a few levels searching for an element whose innerHTML/text contains 'Sender' and an email
      let node = frameEl;
      for (let depth = 0; depth < 6 && node; depth++, node = node.parentElement) {
        try {
          const html = node.innerHTML || '';
          const text = node.textContent || '';
          // look for patterns like "Sender: Name <email>" or "<b>Sender</b>: Name <...>"
          const reEmail = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
          if (/\bSender\b/i.test(html) || /\bSender\b/i.test(text) || /\bFrom\b/i.test(text)) {
            const em = (html.match(reEmail) || text.match(reEmail) || [null])[0];
            if (em) return em;
            // also search for mailto link in this node
            const mailEl = node.querySelector && node.querySelector('a[href^="mailto:"]');
            if (mailEl) {
              const href = mailEl.getAttribute('href') || '';
              const em2 = href.replace(/^mailto:/i,'').split('?')[0];
              if (em2) return em2;
            }
            // as last resort extract name after 'Sender:' and attempt to find email in children
            const inner = node.innerText || '';
            const emAny = inner.match(reEmail);
            if (emAny) return emAny[0];
          }
        } catch(e){}
      }
    } catch(e){}
    return '';
  }

  /* ---------- Persistent mail store (as before) ---------- */
  const STORAGE_KEY = 'ETM_saved_mails_v1';
  let mails = [];

  function storageGet(key){
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([key], (res) => { resolve(res && res[key] ? res[key] : null); });
        } else if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
          browser.storage.local.get(key).then(res => resolve(res && res[key] ? res[key] : null)).catch(()=>resolve(null));
        } else resolve(null);
      } catch(e){ resolve(null); }
    });
  }
  function storageSet(key, value){
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const obj = {}; obj[key] = value;
          chrome.storage.local.set(obj, () => resolve(true));
        } else if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
          const obj = {}; obj[key] = value;
          browser.storage.local.set(obj).then(()=>resolve(true)).catch(()=>resolve(false));
        } else resolve(false);
      } catch(e){ resolve(false); }
    });
  }

  async function loadSavedMails(){
    try {
      const saved = await storageGet(STORAGE_KEY);
      if (Array.isArray(saved)) mails = saved.slice(0); else mails = [];
      return mails.slice(0);
    } catch(e){ mails = []; return mails.slice(0); }
  }
  function saveMailsSync(){ try { storageSet(STORAGE_KEY, mails.slice(0)); } catch(e){} }

  function addMailEntry(entry){
    try {
      if (!entry || !entry.body) return null;
      const incomingBody = entry.body.trim();
      if (mails.length && mails[0].body && mails[0].body === incomingBody) return null;
      // prefer entry.from, else attempt to find sender near iframe (if frameEl provided)
      let fromAddr = entry.from || '';
      if (!fromAddr && entry.frameElement) {
        fromAddr = findSenderNearFrameElement(entry.frameElement) || '';
      }
      const id = 'm_' + Date.now() + '_' + (Math.random().toString(36).slice(2,8));
      const e = {
        id,
        from: fromAddr || '',
        body: incomingBody,
        html: entry.html || '',
        receivedAt: new Date().toISOString()
      };
      mails.unshift(e);
      if (mails.length > 200) mails.length = 200;
      saveMailsSync();
      return e;
    } catch(e) { return null; }
  }

  function getAllMails(){ return mails.slice(0); }
  function getMailById(id){ return mails.find(m => m.id === id) || null; }
  function clearAllMails(){ mails = []; saveMailsSync(); }

  // expose public API
  ns.scraper = {
    getTempEmail,
    scanIframesForDataSrc,
    extractFieldsFromHtml,
    findSenderNearFrameElement,
    // persistence
    loadSavedMails,
    addMailEntry,
    getAllMails,
    getMailById,
    clearAllMails
  };

})(window.ETM = window.ETM || {}, window.ETM);
