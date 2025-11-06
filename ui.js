// ui.js (no preview panel; clicking opens full mail in new tab)
window.ETM = window.ETM || {};
(function(ns){
  const OVERLAY_ID = 'etempmail-overlay-modular';

  function createOverlay(){
    try {
      if (document.getElementById(OVERLAY_ID)) return;
      const o = document.createElement('div');
      o.id = OVERLAY_ID;
      o.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 12px;
        width: 420px;
        max-width: calc(100vw - 24px);
        z-index: 2147483647;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial;
        background: rgba(255,255,255,0.96);
        border-radius: 10px;
        box-shadow: 0 8px 22px rgba(0,0,0,0.14);
        padding: 10px;
        font-size: 13px;
        color: #111;
        border: 1px solid rgba(0,0,0,0.06);
        backdrop-filter: blur(4px);
      `;
      o.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:14px">eTempMail — preview</strong>
          <div style="display:flex;gap:6px;align-items:center">
            <button id="etempmail-refresh" title="Force scan" style="border:0;background:none;cursor:pointer">⟳</button>
            <button id="etempmail-copy" title="Copy email" style="border:0;background:none;cursor:pointer">Copy</button>
          </div>
        </div>

        <div style="margin-bottom:8px;">
          <div id="etempmail-email" style="color:#0b63a4;word-break:break-all;">Email: (waiting…)</div>
        </div>

        <div style="margin-bottom:8px;">
          <div style="font-weight:600;margin-bottom:6px">Mails</div>
          <div id="etempmail-mail-list" style="max-height:260px; overflow:auto; border-radius:6px; border:1px solid rgba(0,0,0,0.05); padding:6px;"></div>
        </div>
      `;
      document.documentElement.appendChild(o);

      const copyBtn = document.getElementById('etempmail-copy');
      copyBtn.addEventListener('click', async () => {
        try {
          const emailText = (document.getElementById('etempmail-email')?.textContent || '').replace(/^Email:\s*/i,'').trim();
          if (!emailText) return;
          await navigator.clipboard.writeText(emailText);
          copyBtn.textContent = '✓';
          setTimeout(()=> copyBtn.textContent = 'Copy', 1200);
        } catch(e) { console.warn('copy failed', e); }
      });

      const refreshBtn = document.getElementById('etempmail-refresh');
      refreshBtn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('ETM_FORCE_SCAN'));
      });

      const list = document.getElementById('etempmail-mail-list');
      list.addEventListener('click', (ev) => {
        const el = ev.target.closest('.etm-mail-item');
        if (!el) return;
        const id = el.dataset.mailId;
        if (!id) return;
        try {
          const m = window.ETM.scraper.getMailById(id);
          if (m) openMailInNewTab(m);
        } catch(e){ console.warn(e); }
      });

    } catch(e){ console.warn('ui.createOverlay failed', e && e.message); }
  }

  function setEmail(email){ try { const el = document.getElementById('etempmail-email'); if (el) el.textContent = email ? `Email: ${email}` : 'Email: (not found)'; } catch(e){} }

  function renderMailList(mails){
    try {
      const container = document.getElementById('etempmail-mail-list');
      if (!container) return;
      container.innerHTML = '';
      if (!mails || mails.length===0) {
        container.innerHTML = '<div style="color:#666;font-size:12px">No mails yet</div>';
        return;
      }
      for (const m of mails) {
        const item = document.createElement('div');
        item.className = 'etm-mail-item';
        item.dataset.mailId = m.id;
        item.style.cssText = 'padding:8px;border-radius:6px;margin-bottom:8px;cursor:pointer;background:#fff;border:1px solid rgba(0,0,0,0.03);';
        const snippet = (m.body || '').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).slice(0,2).join(' — ');
        item.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:13px;color:#111;font-weight:600">${escapeHtml(m.from || '(unknown)')}</div>
            <div style="font-size:11px;color:#666">${new Date(m.receivedAt).toLocaleString()}</div>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(snippet || '(empty preview)')}</div>
        `;
        container.appendChild(item);
      }
      // newest at top, keep scroll at top so newest visible
      container.scrollTop = 0;
    } catch(e){ console.warn('renderMailList failed', e && e.message); }
  }

  function openMailInNewTab(m) {
    try {
      const title = (m.from || '(unknown sender)') + ' — ' + new Date(m.receivedAt).toLocaleString();
      const bodyHtml = m.html && m.html.length>20 ? m.html : ('<pre style="white-space:pre-wrap;font-family:system-ui">' + escapeHtml(m.body || '') + '</pre>');
      const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${bodyHtml}</body></html>`;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(()=> URL.revokeObjectURL(url), 60_000);
    } catch(e){ console.warn('openMailInNewTab failed', e && e.message); }
  }

  function escapeHtml(s){
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; });
  }

  ns.ui = {
    init: function(){ createOverlay(); },
    setEmail,
    renderMailList,
    openMailInNewTab
  };

})(window.ETM);
