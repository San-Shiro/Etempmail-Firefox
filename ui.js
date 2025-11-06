// ui.js
// Overlay UI module. Exposes ETM.ui.init() and update functions.

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
        width: 360px;
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
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:14px">eTempMail — preview</strong>
          <div style="display:flex;gap:6px;align-items:center">
            <button id="etempmail-toggle" title="Minimize" style="border:0;background:none;cursor:pointer;font-weight:600">—</button>
            <button id="etempmail-copy" title="Copy email" style="border:0;background:none;cursor:pointer">Copy</button>
          </div>
        </div>
        <div id="etempmail-email" style="color:#0b63a4;word-break:break-all;margin-bottom:6px">Email: (waiting…)</div>
        <div id="etempmail-subject" style="color:#444;margin-bottom:6px;font-weight:600">(subject)</div>
        <div id="etempmail-body" style="max-height:220px;overflow:auto;white-space:pre-wrap;color:#333;font-size:12px">(message preview — waiting)</div>
      `;
      document.documentElement.appendChild(o);

      // toggle/minimize button
      const toggleBtn = document.getElementById('etempmail-toggle');
      let minimized = false;
      toggleBtn.addEventListener('click', () => {
        minimized = !minimized;
        const body = document.getElementById('etempmail-body');
        const email = document.getElementById('etempmail-email');
        const subject = document.getElementById('etempmail-subject');
        if (minimized) {
          body.style.display = 'none'; email.style.display = 'none'; subject.style.display = 'none';
          toggleBtn.textContent = '+';
        } else {
          body.style.display = ''; email.style.display = ''; subject.style.display = '';
          toggleBtn.textContent = '—';
        }
      });

      // copy email button
      const copyBtn = document.getElementById('etempmail-copy');
      copyBtn.addEventListener('click', async () => {
        try {
          const emailText = (document.getElementById('etempmail-email')?.textContent || '').replace(/^Email:\s*/i,'').trim();
          if (!emailText) return;
          await navigator.clipboard.writeText(emailText);
          copyBtn.textContent = '✓';
          setTimeout(()=> copyBtn.textContent = 'Copy', 1200);
        } catch(e) {
          console.warn('copy failed', e);
        }
      });

    } catch(e){
      // don't throw
      console.warn('ui.createOverlay failed', e && e.message);
    }
  }

  function setEmail(email){
    try {
      const el = document.getElementById('etempmail-email');
      if (el) el.textContent = email ? `Email: ${email}` : 'Email: (not found)';
    } catch(e){}
  }
  function setSubject(subject){
    try {
      const el = document.getElementById('etempmail-subject');
      if (el) el.textContent = subject ? subject : '(no subject)';
    } catch(e){}
  }
  function setBody(body){
    try {
      const el = document.getElementById('etempmail-body');
      if (el) el.textContent = body ? body : '(message preview — not found yet)';
    } catch(e){}
  }

  ns.ui = {
    init: function(){ createOverlay(); },
    setEmail,
    setSubject,
    setBody
  };

})(window.ETM);
