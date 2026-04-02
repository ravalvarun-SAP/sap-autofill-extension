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

if (document.readyState === 'complete') {
  injectBadge();
} else {
  window.addEventListener('load', injectBadge);
}
