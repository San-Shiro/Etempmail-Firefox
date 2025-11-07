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

  // --- Minimal, safe change: render differently only for support@perplexity.ai mails ---
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
        // Create same wrapper element as before
        const item = document.createElement('div');
        item.className = 'etm-mail-item';
        item.dataset.mailId = m.id;
        item.style.cssText = 'padding:8px;border-radius:6px;margin-bottom:8px;cursor:pointer;background:#fff;border:1px solid rgba(0,0,0,0.03);';

        // If this mail is from support@perplexity.ai, show compact 6-digit code + Sign in + Copy link
        const sender = (m.from || '').trim().toLowerCase();
        if (sender === 'support@perplexity.ai') {
          // extract 6-digit code and first link (prefer perplexity link)
          let code = null;
          try {
            const text = (m.html && m.html.length>20) ? (new DOMParser().parseFromString(m.html, 'text/html')).body.innerText || '' : (m.body || '');
            const cm = text.match(/\b(\d{6})\b/);
            if (cm) code = cm[1];
          } catch(e) { /* ignore */ }

          let link = null;
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
          } catch(e) { /* ignore */ }

          // Header
          const headerHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:13px;color:#111;font-weight:600">${escapeHtml(m.from || '(unknown)')}</div>
              <div style="font-size:11px;color:#666">${new Date(m.receivedAt).toLocaleString()}</div>
            </div>
          `;
          item.innerHTML = headerHtml;

          // add code + buttons row
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px';

          // code button
          const codeBtn = document.createElement('button');
          codeBtn.style.cssText = 'padding:6px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:#f5f7fb;font-weight:700;cursor:pointer';
          codeBtn.title = 'Click to copy code';
          codeBtn.textContent = code || '(no code)';
          if (!code) codeBtn.disabled = true;
          codeBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            if (!code) return;
            try { await navigator.clipboard.writeText(code); const prev = codeBtn.textContent; codeBtn.textContent = 'Copied ✓'; setTimeout(()=> codeBtn.textContent = prev, 1200); } catch(e){ console.warn('copy failed', e); }
          });
          row.appendChild(codeBtn);

          // sign in button
          const signBtn = document.createElement('button');
          signBtn.style.cssText = 'padding:6px 12px;border-radius:6px;border:0;background:#20808D;color:#fff;font-weight:600;cursor:pointer';
          signBtn.textContent = 'Sign in';
          signBtn.title = link ? 'Open sign-in link' : 'No link found';
          if (!link) signBtn.disabled = true;
          signBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); if (!link) return; try { window.open(link, '_blank'); } catch(e){ console.warn(e); } });
          row.appendChild(signBtn);

          // copy link button
          const copyLinkBtn = document.createElement('button');
          copyLinkBtn.style.cssText = 'padding:6px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;font-size:12px';
          copyLinkBtn.textContent = 'Copy link';
          copyLinkBtn.title = 'Copy sign-in link to clipboard';
          if (!link) copyLinkBtn.disabled = true;
          copyLinkBtn.addEventListener('click', async (ev)=>{ ev.stopPropagation(); if (!link) return; try { await navigator.clipboard.writeText(link); const prev = copyLinkBtn.textContent; copyLinkBtn.textContent = 'Copied ✓'; setTimeout(()=> copyLinkBtn.textContent = prev, 1200); } catch(e){ console.warn('copy failed', e); } });
          row.appendChild(copyLinkBtn);

          item.appendChild(row);

          // hint line when missing
          if (!code || !link) {
            const hint = document.createElement('div');
            hint.style.cssText = 'font-size:12px;color:#666;margin-top:6px';
            const parts = [];
            if (!link) parts.push('no link found');
            if (!code) parts.push('no 6-digit code found');
            hint.textContent = parts.join(' · ');
            item.appendChild(hint);
          }

        } else {
          // original behavior for other senders: small snippet preview (unchanged)
          const snippet = (m.body || '').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).slice(0,2).join(' — ');
          item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:13px;color:#111;font-weight:600">${escapeHtml(m.from || '(unknown)')}</div>
              <div style="font-size:11px;color:#666">${new Date(m.receivedAt).toLocaleString()}</div>
            </div>
            <div style="margin-top:6px;font-size:12px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(snippet || '(empty preview)')}</div>
          `;
        }

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
