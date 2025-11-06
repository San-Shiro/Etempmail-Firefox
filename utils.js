// utils.js
// Small helpers used by the other modules. Global functions but namespaced to avoid collisions.

window.ETM = window.ETM || {};

(function(ns){
  /**
   * debounce(fn, wait)
   * returns debounced version of fn
   */
  ns.debounce = function(fn, wait){
    let t = null;
    return function(...args){
      if (t) clearTimeout(t);
      t = setTimeout(()=> { t = null; fn.apply(this, args); }, wait);
    };
  };

  /**
   * decodeDataUri(raw)
   * Accepts a data: URI string and returns decoded HTML string or null on failure.
   */
  ns.decodeDataUri = function(raw){
    try {
      if (!raw || typeof raw !== 'string') return null;
      if (!raw.startsWith('data:')) return null;
      const comma = raw.indexOf(',');
      if (comma === -1) return null;
      const meta = raw.slice(5, comma);
      const payload = raw.slice(comma + 1);
      if (meta.includes(';base64')) {
        try {
          return atob(payload);
        } catch(e) {
          return null;
        }
      } else {
        try {
          return decodeURIComponent(payload);
        } catch(e) {
          try { return decodeURI(payload); } catch(e2) { return payload; }
        }
      }
    } catch(e) {
      return null;
    }
  };

  /**
   * parseHtmlToText(html)
   * Parse an HTML string and return visible text (innerText).
   */
  ns.parseHtmlToText = function(html){
    try {
      if (!html) return '';
      const dp = new DOMParser();
      const doc = dp.parseFromString(html, 'text/html');
      return (doc.body && (doc.body.innerText || doc.body.textContent) || '').trim();
    } catch(e) {
      return '';
    }
  };

})(window.ETM);
