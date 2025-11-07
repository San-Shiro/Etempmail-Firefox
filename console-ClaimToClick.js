(async function fullClaimEnterAndTypeFlow_robust() {
  // ---------- CONFIG ----------
  const EMAIL = "roiwzfxavd@ohm.edu.pl";
  const OVERALL_TIMEOUT = 45000; // ms
  const STEP2_TIMEOUT = 20000;   // how long to try to click Enter before giving up
  const POLL = 200;

  // ---------- UTIL ----------
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function now(){ return Date.now(); }
  function textNorm(s){ return (s||'').trim().toLowerCase(); }
  function isVisible(el){
    if(!el) return false;
    try{
      const st = window.getComputedStyle(el);
      if(st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity||'1')===0) return false;
    }catch(e){}
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom >= 0 && r.top <= (window.innerHeight || document.documentElement.clientHeight);
  }

  // safe click with pointer coords then fallback to .click()
  async function safeClick(el){
    if(!el) throw new Error('No element to click');
    try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch(e){}
    await sleep(60);
    try {
      const rect = el.getBoundingClientRect();
      const cx = Math.max(rect.left + rect.width/2, 1);
      const cy = Math.max(rect.top + rect.height/2, 1);
      const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
      el.dispatchEvent(new PointerEvent('pointerover', opts));
      el.dispatchEvent(new MouseEvent('mouseover', opts));
      el.dispatchEvent(new PointerEvent('pointerenter', opts));
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      await sleep(30);
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      await sleep(15);
      el.dispatchEvent(new MouseEvent('click', Object.assign({}, opts, { detail: 1 })));
      el.click && el.click();
      return true;
    } catch(err){
      try { el.click && el.click(); return true; } catch(e){ console.warn('safeClick fallback failed', e); return false; }
    }
  }

  // ---------- FINDERS ----------
  function findClaimButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const button of buttons) {
      const inner = button.querySelector('div.relative.truncate.text-center');
      if (inner && inner.textContent && inner.textContent.trim() === 'Claim invitation') return button;
    }
    // fallback by contains
    return Array.from(document.querySelectorAll('button, [role="button"], a'))
      .find(el => (el.textContent || '').toLowerCase().includes('claim')) || null;
  }

  function findEmailInput() {
    return document.querySelector('input[type="email"], input[name="email"], input[autocomplete="email"], input[placeholder*="email" i], input');
  }

  // scoring for step2 candidate selection (higher = better)
  const enterTokens = ['enter main','enter comet','enter','get started','open','let\'s go','continue','start','join','go','proceed','enter app','enter app'];
  function candidateScore(el){
    let score = 0;
    try {
      const txt = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
      for (const t of enterTokens) if (txt.includes(t)) score += 20;
      if (el.tagName.toLowerCase() === 'button') score += 8;
      if (el.getAttribute && el.getAttribute('role') === 'button') score += 4;
      if (!isVisible(el)) score -= 30;
      if (el.disabled) score -= 10;
      if ((el.getAttribute && el.getAttribute('aria-disabled') === 'true')) score -= 10;
    } catch (e) {}
    return score;
  }

  function findEnterCandidates() {
    const all = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]'));
    const scored = all.map(el => ({ el, score: candidateScore(el), text: (el.textContent||'').trim() }));
    scored.sort((a,b)=>b.score - a.score);
    return scored.filter(s => s.score > -100);
  }

  // ---------- STEP 1: Click "Claim invitation" ----------
  try {
    console.log('[1/4] Locating Claim invitation button...');
    const claimBtn = findClaimButton();
    if (!claimBtn) { console.error('[1] Claim invitation not found — aborting.'); return; }
    console.log('[1] Found claim button:', claimBtn);
    await safeClick(claimBtn);
    console.log('[1] Clicked claim button.');
  } catch (err) {
    console.error('[1] Error clicking claim:', err);
    return;
  }

  // ---------- STEP 2: Robust wait & click for Enter / proceed ----------
  try {
    console.log('[2/4] Waiting for Enter / proceed action (robust mode)...');
    const step2Start = now();
    let observed = false;
    let observer;
    let resolved = false;

    // resolve if email input appears (page advanced)
    const resolveIfEmail = () => {
      const e = findEmailInput();
      if (e) {
        observed = true;
        return e;
      }
      return null;
    };

    const promiseStep2 = new Promise(async (resolve, reject) => {
      // MutationObserver to watch for new buttons/inputs quickly
      observer = new MutationObserver((mList) => {
        if (resolved) return;
        const email = resolveIfEmail();
        if (email) {
          resolved = true; observer.disconnect(); return resolve({ type: 'email-appeared', el: email });
        }
        // if any new candidate appears, try them
        const candidates = findEnterCandidates();
        if (candidates && candidates.length) {
          // if best candidate looks strong, resolve so main logic can try clicking it
          const best = candidates[0];
          if (best.score >= 20) {
            resolved = true; observer.disconnect(); return resolve({ type: 'candidate', el: best.el, debug: best });
          }
        }
      });
      try {
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      } catch(e){}

      // fallback: poll & attempt clicks until timeout
      (async function pollAndTry() {
        while (!resolved) {
          if (now() - step2Start > STEP2_TIMEOUT) {
            resolved = true; try { observer.disconnect(); } catch(e){}; return reject(new Error('Step 2 timed out waiting for Enter/proceed')); 
          }
          // if email input present, we can proceed immediately to typing
          const email = resolveIfEmail();
          if (email) { resolved = true; try{ observer.disconnect(); }catch(e){}; return resolve({ type: 'email-appeared', el: email }); }

          const candidates = findEnterCandidates();
          if (candidates && candidates.length) {
            // try up to top 3 candidates to see if clicking advances UI
            for (let i = 0; i < Math.min(3, candidates.length); i++) {
              const c = candidates[i];
              console.log(`[2] Trying candidate #${i+1} score=${c.score} text="${c.text}"`);
              if (!isVisible(c.el)) { console.log('[2] candidate not visible, skipping'); continue; }
              try {
                await safeClick(c.el);
                await sleep(500);
                // after clicking, check if email input appeared (page advanced)
                const afterEmail = resolveIfEmail();
                if (afterEmail) { resolved = true; try{ observer.disconnect(); }catch(e){}; return resolve({ type: 'clicked-candidate', el: c.el }); }
                // maybe the click opened an intermediate overlay — keep looping
              } catch(e){ console.warn('[2] click attempt failed', e); }
            }
          }
          await sleep(POLL);
        }
      })();
    });

    const step2Result = await promiseStep2.catch(err => { throw err; });
    console.log('[2] Step2 result:', step2Result);
    // if the result included an element and it's not email, ensure it's clicked (best-effort)
    if (step2Result && (step2Result.type === 'candidate' || step2Result.type === 'clicked-candidate')) {
      try {
        console.log('[2] Clicking chosen candidate (final attempt)...');
        await safeClick(step2Result.el);
        await sleep(400);
      } catch(e){ console.warn('[2] final click attempt failed', e); }
    } else if (step2Result && step2Result.type === 'email-appeared') {
      console.log('[2] Email input already present — skipping Enter click.');
    }
  } catch (err) {
    console.warn('[2] Step 2 issue: ', err.message || err);
    // don't abort — try to continue (page may already have progressed)
  }

  // ---------- STEP 3: Wait for email input ----------
  let input = null;
  try {
    console.log('[3/4] Waiting for email input to appear...');
    const start3 = now();
    while (now() - start3 < OVERALL_TIMEOUT) {
      input = findEmailInput();
      if (input) break;
      await sleep(POLL);
    }
    if (!input) { console.error('[3] Email input did not appear — aborting.'); return; }
    console.log('[3] Email input found:', input);
  } catch (err) {
    console.error('[3] Error finding email input:', err);
    return;
  }

  // ---------- STEP 4: Typing routine (preserved exactly) ----------
  (async function robustInPageType_inner() {
    const EMAIL_LOCAL = EMAIL;
    function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function dispatch(type) {
      try { input.dispatchEvent(new Event(type, { bubbles: true })); } catch(e) {}
    }
    function dispatchBeforeInput(data, inputType='insertText') {
      try {
        const ev = new InputEvent('beforeinput', { data, inputType, bubbles: true, cancelable: true });
        input.dispatchEvent(ev);
      } catch(e){}
    }
    function dispatchInput(data, inputType='insertText') {
      try {
        const ev = new InputEvent('input', { data, inputType, bubbles: true, cancelable: false });
        input.dispatchEvent(ev);
      } catch(e){}
    }
    function dispatchComposition(type, data='') {
      try {
        const ev = new CompositionEvent(type, { data, bubbles: true });
        input.dispatchEvent(ev);
      } catch(e){}
    }
    function dispatchKey(name, code, type='keydown') {
      try {
        input.dispatchEvent(new KeyboardEvent(type, { key: name, code, bubbles: true, cancelable: true }));
      } catch(e) {}
    }

    // focus + clear
    try { input.focus(); } catch(e) {}
    try { input.scrollIntoView({ block: "center" }); } catch(e) {}

    try {
      input.setSelectionRange && input.setSelectionRange(0, input.value.length);
      document.execCommand && document.execCommand('delete');
      dispatchInput('', 'deleteContentBackward');
    } catch (e) {}

    dispatchComposition('compositionstart', '');
    dispatch('focus');

    for (let i = 0; i < EMAIL_LOCAL.length; i++) {
      const ch = EMAIL_LOCAL[i];
      await sleep(rand(40, 160));
      dispatchBeforeInput(ch, 'insertText');
      let execOk = false;
      try {
        input.focus();
        execOk = document.execCommand && document.execCommand('insertText', false, ch);
      } catch(e){ execOk = false; }
      if (!execOk) {
        try {
          const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
          const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
          input.value = input.value.slice(0, start) + ch + input.value.slice(end);
          const pos = start + 1;
          input.setSelectionRange && input.setSelectionRange(pos, pos);
        } catch(e) {
          input.value += ch;
        }
      }
      dispatchKey(ch, 'Key' + ch.toUpperCase(), 'keydown');
      dispatchInput(ch, 'insertText');
      dispatchKey(ch, 'Key' + ch.toUpperCase(), 'keyup');

      if (Math.random() < 0.06 && i > 2) {
        await sleep(rand(80, 300));
        try {
          const pos = input.selectionStart || input.value.length;
          if (pos > 0) {
            const newVal = input.value.slice(0, pos - 1) + input.value.slice(pos);
            input.value = newVal;
            input.setSelectionRange && input.setSelectionRange(pos - 1, pos - 1);
          }
        } catch(e){}
        dispatchBeforeInput(null, 'deleteContentBackward');
        dispatchInput(null, 'deleteContentBackward');
        await sleep(rand(80, 150));
        i--;
      }
    }

    dispatchComposition('compositionend', EMAIL_LOCAL);
    dispatchInput(EMAIL_LOCAL, 'insertText');
    dispatch('change');

    console.log('[4/4] ✅ Finished typing. Current input value:', input.value);
    await sleep(600);

    // click Continue with email (exact text)
    const continueBtn = [...document.querySelectorAll('button, [role="button"]')]
      .find(b => (b.textContent || '').trim() === "Continue with email");

    if (continueBtn) {
      try { continueBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
      await sleep(200);
      try {
        continueBtn.click();
        console.log('[4] Clicked "Continue with email".');
      } catch(e){
        try { await safeClick(continueBtn); console.log('[4] safeClick fired for Continue.'); } catch(e2){ console.warn('[4] Continue click fallback failed', e2); }
      }
    } else {
      console.error('[4] Continue button not found after typing.');
    }
  })();

  // overall done
  console.log('Flow triggered — monitor the console for step-by-step logs.');
})();
