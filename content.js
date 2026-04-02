// Content script — runs on SAP SuccessFactors pages
// Listens for messages from popup and can interact with the page

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'ping') {
    sendResponse({ ok: true, url: window.location.href });
  }
  if (msg.action === 'getSkillCount') {
    const tags = getSkillTags();
    sendResponse({ count: tags.length });
  }
  if (msg.action === 'inspectDOM') {
    // Returns a summary of form controls on the page for debugging
    const info = inspectFormElements();
    sendResponse(info);
  }
  return true;
});

function getSkillTags() {
  const results = [];
  const selectors = [
    '[class*="skill"]', '[class*="Tag"]', '[class*="chip"]',
    '[class*="badge"]', '[data-automation-id*="skill"]',
    '[class*="token"]', '[class*="Token"]'
  ];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach(el => {
      if (el.children.length === 0) {
        const t = el.textContent.trim().replace(/^×\s*/, '');
        if (t && t.length > 1 && t.length < 80) results.push(t);
      }
    });
  }
  return [...new Set(results)];
}

// Inspect form elements for debugging — helps identify SAP's DOM structure
function inspectFormElements() {
  const selects = document.querySelectorAll('select');
  const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
  const radios = document.querySelectorAll('input[type="radio"], [role="radio"]');
  const comboboxes = document.querySelectorAll('[role="combobox"], [role="listbox"]');
  const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="Dropdown"], [class*="select"], [class*="Select"]');

  return {
    selects: selects.length,
    checkboxes: checkboxes.length,
    radios: radios.length,
    comboboxes: comboboxes.length,
    customDropdowns: dropdowns.length,
    sampleLabels: Array.from(document.querySelectorAll('label, [class*="label"], [class*="Label"]'))
      .slice(0, 30)
      .map(el => el.textContent.trim().substring(0, 80))
      .filter(t => t.length > 2),
  };
}

// Visual indicator when extension is active
function injectBadge() {
  if (document.getElementById('sf-autofill-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'sf-autofill-badge';
  badge.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: linear-gradient(135deg, #0070f3, #00d4aa);
    color: white;
    font-family: -apple-system, sans-serif;
    font-size: 11px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 20px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,112,243,0.4);
    letter-spacing: 0.04em;
    pointer-events: none;
    opacity: 0.9;
  `;
  badge.textContent = '⚡ SAP AutoFill Active';
  document.body.appendChild(badge);
  setTimeout(() => badge.remove(), 3000);
}

// ── Inject floating action buttons on the page ──
function injectFloatingButtons() {
  if (document.getElementById('sf-autofill-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'sf-autofill-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const btnStyle = `
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    color: white;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3);
    transition: transform 0.1s, box-shadow 0.1s;
    display: flex;
    align-items: center;
    gap: 6px;
  `;

  // Skills button
  const btnSkills = document.createElement('button');
  btnSkills.id = 'sf-btn-skills';
  btnSkills.innerHTML = '🏷️ Skills (trim to 100)';
  btnSkills.style.cssText = btnStyle + 'background: linear-gradient(135deg, #f59e0b, #d97706);';
  btnSkills.onmouseenter = () => { btnSkills.style.transform = 'translateY(-2px)'; };
  btnSkills.onmouseleave = () => { btnSkills.style.transform = 'none'; };
  btnSkills.onclick = trimSkills;

  // Auto Fill button
  const btnFill = document.createElement('button');
  btnFill.id = 'sf-btn-autofill';
  btnFill.innerHTML = '⚡ Auto Fill';
  btnFill.style.cssText = btnStyle + 'background: linear-gradient(135deg, #0070f3, #0051b5);';
  btnFill.onmouseenter = () => { btnFill.style.transform = 'translateY(-2px)'; };
  btnFill.onmouseleave = () => { btnFill.style.transform = 'none'; };
  btnFill.onclick = autoFillForm;

  panel.appendChild(btnSkills);
  panel.appendChild(btnFill);
  document.body.appendChild(panel);
}

// ── Toast notification on page ──
function showToast(msg, color = '#22c55e') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 20px; right: 24px; background: ${color}; color: white;
    padding: 10px 18px; border-radius: 8px; font-family: -apple-system, sans-serif;
    font-size: 13px; font-weight: 600; z-index: 9999999;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3); transition: opacity 0.3s;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ── SKILLS: trim to ≤100 ──
async function trimSkills() {
  const btn = document.getElementById('sf-btn-skills');
  btn.textContent = '⏳ Trimming…';
  btn.disabled = true;

  try {
    const removeButtons = document.querySelectorAll(
      '[class*="skill"] button, [class*="Tag"] button, [aria-label*="remove"], [aria-label*="Remove"], ' +
      '[aria-label*="delete"], [title*="remove"], [title*="Remove"], [class*="chip"] button, ' +
      '[class*="token"] button, [class*="Token"] button, [class*="close"], [class*="Clear"]'
    );
    const maxToRemove = Math.max(0, removeButtons.length - 100);
    if (maxToRemove > 0) {
      const indices = new Set();
      while (indices.size < maxToRemove) indices.add(Math.floor(Math.random() * removeButtons.length));
      const toRemove = [...indices].map(i => removeButtons[i]);
      let removed = 0;
      for (const b of toRemove) {
        b.click();
        await new Promise(r => setTimeout(r, 80));
        removed++;
      }
      showToast(`✓ Removed ${removed} skills → now ≤100`, '#22c55e');
    } else {
      showToast('✓ Skills already ≤100, nothing to remove', '#3b82f6');
    }
  } catch (e) {
    showToast('✗ Error: ' + e.message, '#ef4444');
  }
  btn.innerHTML = '🏷️ Skills (trim to 100)';
  btn.disabled = false;
}

// ── AUTO FILL: checkbox + dropdowns ──
// Uses the exact same proven logic as popup.js fillApplicationForm
async function autoFillForm() {
  const btn = document.getElementById('sf-btn-autofill');
  btn.textContent = '⏳ Filling…';
  btn.disabled = true;
  const results = [];

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Set value on native input/select and fire events
  function setNativeValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Pick an option from a native select by text match (4-pass)
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
    // Pass 1: exact match
    for (const opt of sel.options) {
      if (opt.text.trim().toLowerCase() === optHint) return selectOpt(opt);
    }
    // Pass 2: word-boundary match (avoid "female" matching "male")
    const wordRe = new RegExp('\\b' + optHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    for (const opt of sel.options) {
      if (wordRe.test(opt.text)) return selectOpt(opt);
    }
    // Pass 3: starts-with match
    for (const opt of sel.options) {
      if (opt.text.trim().toLowerCase().startsWith(optHint)) return selectOpt(opt);
    }
    // Pass 4: substring match (last resort)
    for (const opt of sel.options) {
      if (opt.text.toLowerCase().includes(optHint)) return selectOpt(opt);
    }
    return false;
  }

  // GLOBAL: find a native <select> near a label containing labelHint
  function findAndSetGlobalSelect(labelHint, optionText) {
    const hint = labelHint.toLowerCase();
    const optHint = optionText.toLowerCase();

    // Strategy 1: find <label> with matching text, then get its "for" target
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

    // Strategy 2: scan ALL selects and walk up DOM to find nearby label/text
    for (const sel of document.querySelectorAll('select')) {
      let node = sel.parentElement;
      for (let depth = 0; depth < 3 && node; depth++) {
        const directText = Array.from(node.childNodes)
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent).join('').toLowerCase();
        const labelChild = node.querySelector(':scope > label, :scope > span, :scope > p, :scope > div > label');
        const labelText = (labelChild?.textContent || '').toLowerCase();
        if (directText.includes(hint) || labelText.includes(hint)) {
          if (pickOption(sel, optHint)) return true;
        }
        node = node.parentElement;
      }

      // Check label whose "for" points to this select
      if (sel.id) {
        const assocLabel = document.querySelector('label[for="' + CSS.escape(sel.id) + '"]');
        if (assocLabel && assocLabel.textContent.toLowerCase().includes(hint)) {
          return pickOption(sel, optHint);
        }
      }

      // Check preceding siblings
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

  // Find a question/field container by label text
  function findFieldContainer(labelHint) {
    const hint = labelHint.toLowerCase();
    for (const lbl of document.querySelectorAll('label')) {
      if (lbl.textContent.toLowerCase().includes(hint)) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId);
          if (target) return target.closest('div') || target.parentElement;
        }
        let container = lbl.parentElement;
        for (let i = 0; i < 6 && container; i++) {
          if (container.querySelector('select, input, [role="combobox"], [role="listbox"]')) return container;
          container = container.parentElement;
        }
        return lbl.parentElement?.parentElement || lbl.parentElement;
      }
    }
    const candidates = document.querySelectorAll('span, p, div, legend, h3, h4, td, th, [class*="label"], [class*="Label"], [class*="title"], [class*="Title"]');
    for (const el of candidates) {
      const txt = el.textContent.toLowerCase();
      if (txt.includes(hint) && el.children.length < 20) {
        let container = el.parentElement;
        for (let i = 0; i < 6 && container; i++) {
          if (container.querySelector('select, input, [role="combobox"], [role="listbox"]')) return container;
          container = container.parentElement;
        }
        return el.parentElement?.parentElement || el.parentElement;
      }
    }
    return null;
  }

  // Handle custom SAP dropdown / combobox
  async function tryCustomDropdown(container, optionText) {
    const hint = optionText.toLowerCase();
    const triggerSelectors = [
      'select', '[role="combobox"]', '[role="listbox"]',
      '[class*="dropdown"]', '[class*="Dropdown"]',
      '[class*="combobox"]', '[class*="Combobox"]',
      '[data-automation-id*="select"]', '[data-automation-id*="dropdown"]',
      'button[aria-haspopup]', '[aria-haspopup="listbox"]',
      'input[readonly]', '[class*="trigger"]', '[class*="Trigger"]',
    ];
    let trigger = null;
    for (const sel of triggerSelectors) {
      trigger = container.querySelector(sel);
      if (trigger) break;
    }
    if (!trigger) {
      const divs = container.querySelectorAll('div[tabindex], div[role], span[tabindex], button');
      for (const d of divs) {
        const cls = (d.className || '').toLowerCase();
        if (cls.includes('select') || cls.includes('drop') || cls.includes('combo') || cls.includes('picker')
          || d.getAttribute('role') === 'button' || d.getAttribute('aria-haspopup')) {
          trigger = d; break;
        }
      }
    }
    if (!trigger) return false;
    if (trigger.tagName === 'SELECT') {
      for (const opt of trigger.options) {
        if (opt.text.toLowerCase().includes(hint)) {
          trigger.value = opt.value;
          trigger.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }
    trigger.click();
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(500);
    const optionSelectors = [
      '[role="option"]', '[role="menuitem"]',
      'li[class*="option"]', 'li[class*="Option"]', 'li[class*="item"]', 'li[class*="Item"]',
      'div[class*="option"]', 'div[class*="Option"]',
      '[data-automation-id*="option"]', 'ul[role="listbox"] li', 'ul li',
    ];
    const wordRe = new RegExp('\\b' + hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    let found = false;
    for (const sel of optionSelectors) {
      for (const opt of document.querySelectorAll(sel)) {
        if (opt.textContent.trim().toLowerCase() === hint) { opt.click(); await sleep(200); found = true; break; }
      }
      if (found) break;
    }
    if (!found) {
      for (const sel of optionSelectors) {
        for (const opt of document.querySelectorAll(sel)) {
          if (wordRe.test(opt.textContent.trim())) { opt.click(); await sleep(200); found = true; break; }
        }
        if (found) break;
      }
    }
    if (!found) {
      for (const sel of optionSelectors) {
        for (const opt of document.querySelectorAll(sel)) {
          if (opt.textContent.trim().toLowerCase().includes(hint)) { opt.click(); await sleep(200); found = true; break; }
        }
        if (found) break;
      }
    }
    if (!found) {
      const searchInput = document.querySelector('[class*="search"] input, [role="combobox"] input, [class*="filter"] input')
        || container.querySelector('input[type="text"], input:not([type])');
      if (searchInput) {
        setNativeValue(searchInput, optionText);
        await sleep(500);
        for (const sel of optionSelectors) {
          for (const opt of document.querySelectorAll(sel)) {
            if (wordRe.test(opt.textContent.trim()) || opt.textContent.trim().toLowerCase() === hint) { opt.click(); found = true; break; }
          }
          if (found) break;
        }
      }
    }
    if (!found) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(200);
    }
    return found;
  }

  // Handle radio buttons
  function tryRadioButtons(container, optionText) {
    const hint = optionText.toLowerCase();
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      const lbl = radio.closest('label') || radio.parentElement;
      const text = lbl?.textContent?.toLowerCase() || '';
      if (text.includes(hint)) { radio.click(); radio.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      if (radio.id) {
        const assocLabel = document.querySelector('label[for="' + CSS.escape(radio.id) + '"]');
        if (assocLabel && assocLabel.textContent.toLowerCase().includes(hint)) { radio.click(); radio.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      }
    }
    const options = container.querySelectorAll('[role="radio"], [class*="radio"], [class*="Radio"]');
    for (const opt of options) {
      if (opt.textContent.toLowerCase().includes(hint)) { opt.click(); return true; }
    }
    return false;
  }

  // Master selector: tries global select scan first, then container-based approaches
  async function selectField(labelHint, optionText) {
    if (findAndSetGlobalSelect(labelHint, optionText)) return true;
    const container = findFieldContainer(labelHint);
    if (!container) return false;
    if (tryRadioButtons(container, optionText)) return true;
    if (await tryCustomDropdown(container, optionText)) return true;
    const wider = container.parentElement?.parentElement || container.parentElement;
    if (wider && wider !== container) {
      if (tryRadioButtons(wider, optionText)) return true;
      if (await tryCustomDropdown(wider, optionText)) return true;
    }
    return false;
  }

  try {
    // Sanction checkbox
    let sanctionDone = false;
    for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
      const container = cb.closest('div[class], label, fieldset, tr') || cb.parentElement;
      const text = (container?.textContent || '').toLowerCase();
      if (text.includes('sanction') || text.includes('export control') || text.includes('screening')) {
        if (!cb.checked) { cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); }
        sanctionDone = true; results.push('✓ Sanction checkbox'); break;
      }
    }
    if (!sanctionDone) {
      for (const el of document.querySelectorAll('[role="checkbox"]')) {
        const text = (el.closest('div')?.textContent || el.textContent || '').toLowerCase();
        if (text.includes('sanction') || text.includes('screening')) {
          if (el.getAttribute('aria-checked') !== 'true') el.click();
          sanctionDone = true; results.push('✓ Sanction checkbox'); break;
        }
      }
    }
    if (!sanctionDone) results.push('⚠ Sanction checkbox not found');
    await sleep(400);

    // Dropdowns — same field definitions as popup.js
    const fields = [
      ['legally authorized', 'yes'],
      ['currently employed', 'none of the above'],
      ['previously employed', 'yes'],
      ['country of residence', 'germany'],
      ['your gender', 'male'],
    ];

    for (const [label, value] of fields) {
      let done = await selectField(label, value);
      // Retry with shorter hint
      if (!done) {
        const short = label.split(' ').slice(-1)[0];
        done = await selectField(short, value);
      }
      results.push(done ? '✓ ' + label : '⚠ ' + label + ' — not found');
      await sleep(500);
    }

    showToast('✓ Auto Fill Complete', '#22c55e');
    console.log('[SAP AutoFill]', results);
  } catch (e) {
    showToast('✗ Error: ' + e.message, '#ef4444');
    console.error('[SAP AutoFill]', e);
  }

  btn.innerHTML = '⚡ Auto Fill';
  btn.disabled = false;
}

if (document.readyState === 'complete') {
  injectBadge();
  injectFloatingButtons();
} else {
  window.addEventListener('load', () => {
    injectBadge();
    injectFloatingButtons();
  });
}
