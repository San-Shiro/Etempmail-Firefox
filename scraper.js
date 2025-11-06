// scraper.js
// All scraping-related functions are here and exposed via ETM.scraper.*

// Responsibilities:
// - getTempEmail(): tries multiple selectors to find the allotted temp email
// - scanIframesForDataSrc(): looks for data: iframe src and decodes it; falls back to contentDocument if available
// - extractFieldsFromHtml(html): parse HTML and return {subject, from, bodyText} (simple heuristic now; extendable later)

window.ETM = window.ETM || {};
(function(ns, utils){
  // Helper: safe query
  function safeQuery(selector){
    try { return document.querySelector(selector); } catch(e) { return null; }
  }

  /**
   * getTempEmail()
   * Return the allocated temp email string or empty string.
   */
  ns.getTempEmail = function(){
    try {
      // primary: #tempEmailAddress (observed on page)
      const input = safeQuery('#tempEmailAddress');
      if (input && (input.value || '').trim()) return input.value.trim();

      // fallback: input[name=email] or other common selectors
      const alt = safeQuery('input[name="email"], input[type="email"]');
      if (alt && (alt.value || '').trim()) return alt.value.trim();

      // fallback: elements with class or id containing "email"
      const any = Array.from(document.querySelectorAll('[id*="email"], [class*="email"]')).map(n => n.textContent || n.value || '').find(Boolean);
      if (any) return String(any).trim();

      return '';
    } catch(e) {
      return '';
    }
  };

  /**
   * scanIframesForDataSrc()
   * Scans all iframes and returns first meaningful result:
   * { index, html, text } or null
   */
  ns.scanIframesForDataSrc = function(){
    try {
      const frames = Array.from(document.querySelectorAll('iframe'));
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        try {
          const raw = f.getAttribute('src') || f.src || '';
          if (raw && raw.startsWith('data:')) {
            const html = utils.decodeDataUri(raw);
            const text = utils.parseHtmlToText(html);
            // If text is non-empty, return it. Otherwise still return html if present
            if (text && text.length > 0) return { index: i, html, text };
            if (html) return { index: i, html, text: '' };
          }
          // fallback: if contentDocument accessible (same-origin and ready)
          try {
            const doc = f.contentDocument;
            if (doc && doc.body) {
              const t = (doc.body.innerText || doc.body.textContent || '').trim();
              if (t) return { index: i, html: doc.documentElement.outerHTML, text: t };
            }
          } catch(e){}
        } catch(e){}
      }
    } catch(e){}
    return null;
  };

  /**
   * extractFieldsFromHtml(html)
   * Very lightweight heuristics to extract subject/from/body.
   * This should be extended to match the actual mail HTML structure of etempmail.
   */
  ns.extractFieldsFromHtml = function(html){
    const out = { subject: '', from: '', body: '' };
    try {
      if (!html) return out;
      // parse
      const dp = new DOMParser();
      const doc = dp.parseFromString(html, 'text/html');

      // heuristics:
      // 1) find <title> or meta og:title for subject
      const title = (doc.querySelector('title') && doc.querySelector('title').textContent) || '';
      if (title) out.subject = title.trim();

      // 2) find common header elements that might contain from/subject
      const headerText = Array.from(doc.querySelectorAll('h1,h2,h3,strong,b')).map(n => n.textContent || '').join(' | ');
      if (!out.subject && headerText) out.subject = headerText.split('|')[0].trim();

      // 3) try to find email address-looking strings inside doc
      const emailMatch = (doc.body && doc.body.textContent || '').match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
      if (emailMatch) out.from = emailMatch[0];

      // 4) body: use innerText of body
      out.body = (doc.body && (doc.body.innerText || doc.body.textContent) || '').trim();

      return out;
    } catch(e) {
      return out;
    }
  };

  // Expose
  ns.scraper = {
    getTempEmail: ns.getTempEmail,
    scanIframesForDataSrc: ns.scanIframesForDataSrc,
    extractFieldsFromHtml: ns.extractFieldsFromHtml
  };

})(window.ETM, window.ETM);

