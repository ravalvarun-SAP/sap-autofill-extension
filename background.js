// Background service worker — relays auto-continue message back to popup logic
// When content script detects the continue flag after page reload,
// it triggers the remaining fill steps directly.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'autoContinueFill' && sender.tab) {
    console.log('[SAP AutoFill BG] Auto-continue triggered, injecting fill steps...');
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: fillRemainingSteps
    }).then(results => {
      const report = results[0]?.result || {};
      console.log('[SAP AutoFill BG] Fill report:', report);
    }).catch(err => {
      console.error('[SAP AutoFill BG] Fill error:', err);
    });
    sendResponse({ ok: true });
  }
  return true;
});

// This function runs on the page — fills everything EXCEPT skills (already done)
function fillRemainingSteps() {
  const steps = [];
  const errors = [];

  function logStep(msg, ok = true) { steps.push({ msg, ok }); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function findAndSetGlobalSelect(labelHint, optionText) {
    const hint = labelHint.toLowerCase();
    const optHint = optionText.toLowerCase();

    for (const lbl of document.querySelectorAll('label')) {
      if (lbl.textContent.toLowerCase().includes(hint)) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId);
          if (target && target.tagName === 'SELECT') {
            return pickOption(target, optHint);
          }
        }
      }
    }

    for (const sel of document.querySelectorAll('select')) {
      let node = sel.parentElement;
      for (let depth = 0; depth < 3 && node; depth++) {
        const directText = Array.from(node.childNodes)
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent).join('').toLowerCase();
        const labelChild = node.querySelector(':scope > label, :scope > span, :scope > p, :scope > div > label');
        const labelText = (labelChild?.textContent || '').toLowerCase();
        if (directText.includes(hint) || labelText.includes(hint)) {
          const result = pickOption(sel, optHint);
          if (result) return true;
        }
        node = node.parentElement;
      }

      if (sel.id) {
        const assocLabel = document.querySelector(`label[for="${sel.id}"]`);
        if (assocLabel && assocLabel.textContent.toLowerCase().includes(hint)) {
          return pickOption(sel, optHint);
        }
      }

      let prev = sel.previousElementSibling || sel.parentElement?.previousElementSibling;
      for (let i = 0; i < 5 && prev; i++) {
        if (prev.textContent?.toLowerCase().includes(hint)) {
          return pickOption(sel, optHint);
        }
        prev = prev.previousElementSibling;
      }
    }
    return false;
  }

  function pickOption(sel, optHint) {
    function selectOpt(opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(sel, opt.value);
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    for (const opt of sel.options) {
      if (opt.text.trim().toLowerCase() === optHint) return selectOpt(opt);
    }
    const wordRe = new RegExp('\\b' + optHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    for (const opt of sel.options) {
      if (wordRe.test(opt.text)) return selectOpt(opt);
    }
    for (const opt of sel.options) {
      if (opt.text.trim().toLowerCase().startsWith(optHint)) return selectOpt(opt);
    }
    for (const opt of sel.options) {
      if (opt.text.toLowerCase().includes(optHint)) return selectOpt(opt);
    }
    return false;
  }

  async function selectField(labelHint, optionText) {
    return findAndSetGlobalSelect(labelHint, optionText);
  }

  return (async () => {
    logStep('✓ Auto-continuing after page reload (skills already trimmed)');
    await sleep(500);

    // Sanction checkbox
    try {
      let sanctionCB = null;
      for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
        const container = cb.closest('div[class], label, fieldset, tr') || cb.parentElement;
        const text = (container?.textContent || '').toLowerCase();
        if (text.includes('sanction') || text.includes('export control') || text.includes('screening')) {
          sanctionCB = cb; break;
        }
      }
      if (!sanctionCB) {
        for (const el of document.querySelectorAll('[role="checkbox"]')) {
          const text = (el.closest('div')?.textContent || el.textContent || '').toLowerCase();
          if (text.includes('sanction') || text.includes('screening')) {
            if (el.getAttribute('aria-checked') !== 'true') el.click();
            sanctionCB = el; break;
          }
        }
      }
      if (sanctionCB && sanctionCB.tagName === 'INPUT') {
        if (!sanctionCB.checked) {
          sanctionCB.click();
          sanctionCB.dispatchEvent(new Event('change', { bubbles: true }));
        }
        logStep('✓ SAP Sanction consent checkbox ticked');
      } else if (sanctionCB) {
        logStep('✓ SAP Sanction consent checkbox ticked');
      } else {
        logStep('Sanction checkbox not found on this page', false);
      }
    } catch (e) { errors.push('Sanction: ' + e.message); }

    await sleep(400);

    try {
      const done = await selectField('legally authorized', 'yes');
      logStep(done ? '✓ Legally authorized = Yes' : 'Auth dropdown not found', done);
    } catch (e) { errors.push('Auth: ' + e.message); }
    await sleep(500);

    try {
      const done = await selectField('currently employed', 'none of the above');
      logStep(done ? '✓ Currently employed = None of the Above' : 'Employment dropdown not found', done);
    } catch (e) { errors.push('Employment: ' + e.message); }
    await sleep(500);

    try {
      const done = await selectField('previously employed', 'yes');
      logStep(done ? '✓ Previously employed = Yes' : 'Prev employed dropdown not found', done);
    } catch (e) { errors.push('Prev employed: ' + e.message); }
    await sleep(500);

    try {
      let done = await selectField('country of residence', 'germany');
      if (!done) done = await selectField('country', 'germany');
      logStep(done ? '✓ Country = Germany' : 'Country dropdown not found', done);
    } catch (e) { errors.push('Country: ' + e.message); }
    await sleep(500);

    try {
      let done = await selectField('your gender', 'male');
      if (!done) done = await selectField('gender', 'male');
      logStep(done ? '✓ Gender = Male' : 'Gender dropdown not found', done);
    } catch (e) { errors.push('Gender: ' + e.message); }

    // Show a completion badge
    const badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:20px;right:20px;background:#22c55e;color:white;padding:12px 20px;border-radius:8px;font-family:sans-serif;font-size:14px;font-weight:600;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    badge.textContent = '✓ SAP AutoFill Complete';
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 5000);

    console.log('[SAP AutoFill] Steps:', steps);
    if (errors.length) console.warn('[SAP AutoFill] Errors:', errors);
    return { steps, errors };
  })();
}
