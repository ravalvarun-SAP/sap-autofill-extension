// All 100 skills from the profile screenshot
const ALL_SKILLS = [
  "Writing Documentation","Microsoft Excel","Material Design","SAP Cloud","GPT","English",
  "SAP UI5","Communication Skills","Prompt Engineering","3D Piping Design","Restful APIs",
  "SAP HANA","Workflows","Wikis","Demonstration Skills","Playwright","Digital Assets",
  "Motion Graphic Design","Jupyter Notebook","Filmmaking","Automation","Business Process Mapping",
  "Instructional Design","Data Management","Adobe Creative Cloud","Project Management","Pandas",
  "Security Analysis","Sap Fiori","Administrative Operations","Data Analysis","Pre-Production",
  "Brand Management","Team Working","Microsoft Power Automate","SAP Applications","Event Management",
  "Adobe After Effects","Software Architecture","SAP Materials Management","Testing Skills",
  "Peer Review","German","Universal Design","HTML","JavaScript (Programming Language)",
  "Requirements Analysis","Cloud Computing","Chemical Synthesis","User Research",
  "Technical Documentation","SAP Business Technology Platform","Software Documentation","Power BI",
  "Process Visualization","Microsoft PowerPoint","Self Motivation","Interpersonal Communications",
  "Visual Effects","Cascading Style Sheets (CSS)","Microsoft Outlook","Node.Js","Adobe Photoshop",
  "Sponsored Content","Advanced Business Application Programming (ABAP)","Multimedia","SAP ABAP",
  "Live Streaming","Passionate","Microsoft SharePoint","Microsoft Office","Regulatory Compliance",
  "JIRA","Computer Animation","Internal Communications","SAP ERP","Product Management",
  "Collaborative Software","Signavio","Design Thinking","Microsoft Word","Visual Communications",
  "Intelligent Systems","Sales","Low Latency","Computer Programming","Python (Programming Language)",
  "Backend","Api Management","Software Debugging","Performance Tuning","SAP S/4HANA",
  "Large Language Models","Communication Design","Data Pipelines","Systems Integration","WebRTC","WebSocket"
];

// Ensure max 100 unique skills
function getSkills(fromStorage) {
  let skills = fromStorage && fromStorage.length ? fromStorage : ALL_SKILLS;
  // Deduplicate
  skills = [...new Set(skills)];
  // Trim to 100
  if (skills.length > 100) {
    const indices = new Set();
    while (indices.size < 100) indices.add(Math.floor(Math.random() * skills.length));
    skills = [...indices].map(i => skills[i]);
  }
  return skills;
}

// ---- DOM refs ----
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const notSapMsg = document.getElementById('notSapMsg');
const sapContent = document.getElementById('sapContent');
const skillsPreview = document.getElementById('skillsPreview');
const skillsCountText = document.getElementById('skillsCountText');
const skillCountBadge = document.getElementById('skillCountBadge');
const btnFillForm = document.getElementById('btnFillForm');
const btnExtractSkills = document.getElementById('btnExtractSkills');
const btnDebugDOM = document.getElementById('btnDebugDOM');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const progressPct = document.getElementById('progressPct');
const logArea = document.getElementById('logArea');

// ---- Collapsibles ----
document.querySelectorAll('.toggle-section').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.dataset.target;
    const body = document.getElementById(target);
    const chevron = el.querySelector('.chevron');
    body.classList.toggle('open');
    chevron.classList.toggle('open');
  });
});

// ---- Logging ----
function log(msg, type = 'info') {
  const now = new Date();
  const t = now.toTimeString().slice(0,8);
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${t}</span><span class="log-msg ${type}">${msg}</span>`;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

// ---- Progress ----
function setProgress(pct, label) {
  progressWrap.classList.add('visible');
  progressFill.style.width = pct + '%';
  progressLabel.textContent = label || 'Processing…';
  progressPct.textContent = pct + '%';
}

function hideProgress() {
  setTimeout(() => progressWrap.classList.remove('visible'), 1500);
}

// ---- Skills preview ----
function renderSkillsPreview(skills) {
  skillsPreview.innerHTML = '';
  const show = skills.slice(0, 30);
  show.forEach(s => {
    const tag = document.createElement('span');
    tag.className = 'skill-tag';
    tag.textContent = s;
    skillsPreview.appendChild(tag);
  });
  const total = skills.length;
  skillCountBadge.textContent = total;
  skillsCountText.textContent = total > 30 ? `Showing 30 of ${total} skills` : `${total} skills loaded`;
}

// ---- Init: check current tab ----
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url || '';
  const isSAP = url.includes('successfactors');

  if (!isSAP) {
    statusDot.className = 'status-dot warn';
    statusText.innerHTML = '<strong>Not on SAP SuccessFactors</strong>';
    notSapMsg.style.display = 'block';
    sapContent.style.display = 'none';
    return;
  }

  statusDot.className = 'status-dot active';
  statusText.innerHTML = '<strong>SAP SuccessFactors</strong> detected';
  notSapMsg.style.display = 'none';
  sapContent.style.display = 'block';

  // Load saved skills or default
  const result = await chrome.storage.local.get('skills');
  const skills = getSkills(result.skills);
  renderSkillsPreview(skills);
  log('Extension ready — ' + skills.length + ' skills loaded', 'success');
}

// ---- Extract skills from page ----
btnExtractSkills.addEventListener('click', async () => {
  btnExtractSkills.disabled = true;
  btnExtractSkills.textContent = 'Extracting…';
  log('Scanning page for skills…', 'info');
  setProgress(10, 'Scanning page…');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try to find skill tags on SAP SuccessFactors profile page
        const tags = [];
        // Common selectors for SF skill tags
        const selectors = [
          '[class*="skill"] [class*="tag"]',
          '[class*="skill"] span',
          '[data-automation-id*="skill"]',
          '.skill-tag', '.tag-label',
          '[class*="Tag"] span',
          '[class*="chip"] span',
        ];
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const text = el.textContent.trim();
            if (text && text.length > 1 && text.length < 80 && !text.includes('×')) {
              tags.push(text);
            }
          });
          if (tags.length > 10) break;
        }
        // Also look for any element containing skill text next to × buttons
        document.querySelectorAll('button, span, div').forEach(el => {
          if (el.children.length === 0) {
            const text = el.textContent.trim();
            const parent = el.parentElement;
            if (parent && parent.textContent.includes('×') && text.length > 1 && text.length < 80) {
              tags.push(text.replace('×', '').trim());
            }
          }
        });
        return [...new Set(tags.filter(Boolean))];
      }
    });

    const extracted = results[0]?.result || [];
    setProgress(80, 'Processing skills…');

    if (extracted.length > 5) {
      const skills = getSkills(extracted);
      await chrome.storage.local.set({ skills });
      renderSkillsPreview(skills);
      log(`Extracted ${extracted.length} skills → using ${skills.length}`, 'success');
      setProgress(100, 'Done!');
    } else {
      log('Could not auto-extract. Using default 100 skills.', 'warn');
      const skills = getSkills([]);
      await chrome.storage.local.set({ skills });
      renderSkillsPreview(skills);
      setProgress(100, 'Using defaults');
    }
  } catch (e) {
    log('Extract error: ' + e.message, 'error');
    setProgress(0, 'Error');
  } finally {
    hideProgress();
    btnExtractSkills.disabled = false;
    btnExtractSkills.textContent = 'Extract Skills';
  }
});

// ---- Auto-fill form ----
btnFillForm.addEventListener('click', async () => {
  btnFillForm.disabled = true;
  btnFillForm.textContent = '⏳ Running…';
  log('Starting auto-fill sequence…', 'info');
  setProgress(5, 'Injecting script…');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.storage.local.get('skills');
  const skills = getSkills(result.skills);

  try {
    const fillResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillApplicationForm,
      args: [skills]
    });

    const report = fillResults[0]?.result || {};
    setProgress(100, 'Complete!');

    // Log each step result
    (report.steps || []).forEach(step => {
      log(step.msg, step.ok ? 'success' : 'warn');
    });

    if (report.errors && report.errors.length) {
      report.errors.forEach(e => log('⚠ ' + e, 'error'));
    }

    log('Auto-fill complete!', 'success');
    statusDot.className = 'status-dot active';

  } catch (e) {
    log('Fill error: ' + e.message, 'error');
    setProgress(0, 'Error occurred');
  } finally {
    hideProgress();
    btnFillForm.disabled = false;
    btnFillForm.textContent = '⚡ Auto-Fill Form';
  }
});

// ---- Debug DOM: inspect what SAP elements are on the page ----
btnDebugDOM.addEventListener('click', async () => {
  log('Inspecting page DOM…', 'info');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selects = document.querySelectorAll('select');
        const checkboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"], [role="radio"]');
        const comboboxes = document.querySelectorAll('[role="combobox"], [role="listbox"]');
        const labels = Array.from(document.querySelectorAll('label, [class*="label"], [class*="Label"], legend, [class*="question"], [class*="Question"]'))
          .map(el => el.textContent.trim().substring(0, 100))
          .filter(t => t.length > 2 && t.length < 100);
        return {
          selects: selects.length,
          checkboxes: checkboxes.length,
          radios: radios.length,
          comboboxes: comboboxes.length,
          labels: [...new Set(labels)].slice(0, 25),
        };
      }
    });
    const info = results[0]?.result || {};
    log(`Selects: ${info.selects} | Checkboxes: ${info.checkboxes} | Radios: ${info.radios} | Comboboxes: ${info.comboboxes}`, 'info');
    (info.labels || []).forEach(l => log('Label: ' + l, 'info'));
  } catch (e) {
    log('Debug error: ' + e.message, 'error');
  }
});

// ---- The actual content script function (injected into page) ----
function fillApplicationForm(skills) {
  const steps = [];
  const errors = [];

  function logStep(msg, ok = true) { steps.push({ msg, ok }); }

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

  // ── GLOBAL: find a native <select> near a label containing labelHint ──
  // This is the most reliable approach for SAP SF which uses native selects
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

    // Strategy 2: scan ALL selects and walk up DOM to find nearby label/text containing hint
    for (const sel of document.querySelectorAll('select')) {
      // Walk up through ancestors to check for label text
      let node = sel.parentElement;
      for (let depth = 0; depth < 8 && node; depth++) {
        const txt = node.textContent?.toLowerCase() || '';
        if (txt.includes(hint)) {
          const result = pickOption(sel, optHint);
          if (result) return true;
        }
        node = node.parentElement;
      }

      // Also check: any label whose "for" points to this select
      if (sel.id) {
        const assocLabel = document.querySelector(`label[for="${sel.id}"]`);
        if (assocLabel && assocLabel.textContent.toLowerCase().includes(hint)) {
          return pickOption(sel, optHint);
        }
      }

      // Also check preceding siblings and previous elements for label text
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

  // Pick an option from a native select by text match
  function pickOption(sel, optHint) {
    // Exact includes match
    for (const opt of sel.options) {
      if (opt.text.toLowerCase().includes(optHint)) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        // Also try the native setter for React/Angular frameworks
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(sel, opt.value);
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }
    }
    // Partial / fuzzy match
    for (const opt of sel.options) {
      const oText = opt.text.toLowerCase();
      if (oText.startsWith(optHint) || optHint.startsWith(oText.substring(0, 4))) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // ── Find a question/field container by label text (case-insensitive) ──
  function findFieldContainer(labelHint) {
    const hint = labelHint.toLowerCase();
    // Strategy 1: <label> elements
    for (const lbl of document.querySelectorAll('label')) {
      if (lbl.textContent.toLowerCase().includes(hint)) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId);
          if (target) return target.closest('div') || target.parentElement;
        }
        // Walk up to find a container that also has a select/input
        let container = lbl.parentElement;
        for (let i = 0; i < 6 && container; i++) {
          if (container.querySelector('select, input, [role="combobox"], [role="listbox"]')) return container;
          container = container.parentElement;
        }
        return lbl.parentElement?.parentElement || lbl.parentElement;
      }
    }
    // Strategy 2: any element whose text matches
    const candidates = document.querySelectorAll('span, p, div, legend, h3, h4, td, th, [class*="label"], [class*="Label"], [class*="title"], [class*="Title"]');
    for (const el of candidates) {
      const txt = el.textContent.toLowerCase();
      // Remove length restriction — SAP labels can be very long (gender field!)
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

  // ── Handle custom SAP dropdown / combobox ──
  async function tryCustomDropdown(container, optionText) {
    const hint = optionText.toLowerCase();

    // Find the trigger: anything that looks clickable and acts as a dropdown
    const triggerSelectors = [
      'select',
      '[role="combobox"]', '[role="listbox"]',
      '[class*="dropdown"]', '[class*="Dropdown"]',
      '[class*="select"]', '[class*="Select"]',
      '[class*="combo"]', '[class*="Combo"]',
      '[data-automation-id*="select"]', '[data-automation-id*="dropdown"]',
      'button[aria-haspopup]', '[aria-haspopup="listbox"]',
      'input[readonly]',
      '[class*="trigger"]', '[class*="Trigger"]',
    ];

    let trigger = null;
    for (const sel of triggerSelectors) {
      trigger = container.querySelector(sel);
      if (trigger) break;
    }

    // Fallback: check for a clickable div that looks dropdown-ish
    if (!trigger) {
      const divs = container.querySelectorAll('div[tabindex], div[role], span[tabindex], button');
      for (const d of divs) {
        const cls = (d.className || '').toLowerCase();
        if (cls.includes('select') || cls.includes('drop') || cls.includes('combo') || cls.includes('picker')
          || d.getAttribute('role') === 'button' || d.getAttribute('aria-haspopup')) {
          trigger = d;
          break;
        }
      }
    }

    if (!trigger) return false;

    // If it's a native select, handle directly
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

    // Click the trigger to open the dropdown
    trigger.click();
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(500);

    // Now look for the options in the opened dropdown overlay (search whole document)
    const optionSelectors = [
      '[role="option"]', '[role="menuitem"]',
      'li[class*="option"]', 'li[class*="Option"]', 'li[class*="item"]', 'li[class*="Item"]',
      'div[class*="option"]', 'div[class*="Option"]',
      '[class*="menuItem"]', '[class*="MenuItem"]',
      '[data-automation-id*="option"]',
      'ul[role="listbox"] li', 'ul li',
    ];

    let found = false;
    for (const sel of optionSelectors) {
      const opts = document.querySelectorAll(sel);
      for (const opt of opts) {
        const text = opt.textContent.trim().toLowerCase();
        if (text.includes(hint) || hint.includes(text.substring(0, Math.min(text.length, 10)))) {
          opt.click();
          opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          await sleep(200);
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // If still not found, try typing into an input inside the dropdown (search/filter)
    if (!found) {
      const searchInput = document.querySelector('[class*="search"] input, [role="combobox"] input, [class*="filter"] input')
        || container.querySelector('input[type="text"], input:not([type])');
      if (searchInput) {
        setNativeValue(searchInput, optionText);
        await sleep(500);
        // Pick the first matching option
        for (const sel of optionSelectors) {
          const opts = document.querySelectorAll(sel);
          for (const opt of opts) {
            if (opt.textContent.trim().toLowerCase().includes(hint)) {
              opt.click();
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    // Close dropdown if we failed (press Escape)
    if (!found) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(200);
    }

    return found;
  }

  // ── Handle radio buttons ──
  function tryRadioButtons(container, optionText) {
    const hint = optionText.toLowerCase();
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      const lbl = radio.closest('label') || radio.parentElement;
      const text = lbl?.textContent?.toLowerCase() || '';
      if (text.includes(hint)) {
        radio.click();
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      // Check for associated label via id
      if (radio.id) {
        const assocLabel = document.querySelector(`label[for="${radio.id}"]`);
        if (assocLabel && assocLabel.textContent.toLowerCase().includes(hint)) {
          radio.click();
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    }
    // Also try clickable div/span options (SAP custom radio-like widgets)
    const options = container.querySelectorAll('[role="radio"], [class*="radio"], [class*="Radio"]');
    for (const opt of options) {
      if (opt.textContent.toLowerCase().includes(hint)) {
        opt.click();
        return true;
      }
    }
    return false;
  }

  // ── Master selector: tries global select scan first, then container-based approaches ──
  async function selectField(labelHint, optionText) {
    // BEST: direct global select scan (most reliable for native selects)
    if (findAndSetGlobalSelect(labelHint, optionText)) return true;

    // Fallback: container-based search
    const container = findFieldContainer(labelHint);
    if (!container) return false;

    // Try radio buttons
    if (tryRadioButtons(container, optionText)) return true;
    // Try custom dropdown
    if (await tryCustomDropdown(container, optionText)) return true;

    // Broadened: search in a wider ancestor
    const wider = container.parentElement?.parentElement || container.parentElement;
    if (wider && wider !== container) {
      if (tryRadioButtons(wider, optionText)) return true;
      if (await tryCustomDropdown(wider, optionText)) return true;
    }

    return false;
  }

  return (async () => {

    // ── STEP 4: Skills — remove extras if >100 shown ──
    try {
      const removeButtons = document.querySelectorAll(
        '[class*="skill"] button, [class*="Tag"] button, [aria-label*="remove"], [aria-label*="Remove"], ' +
        '[aria-label*="delete"], [title*="remove"], [title*="Remove"], [class*="chip"] button, ' +
        '[class*="token"] button, [class*="Token"] button, [class*="close"], [class*="Clear"]'
      );
      let removed = 0;
      const maxToRemove = Math.max(0, removeButtons.length - 100);
      if (maxToRemove > 0) {
        const indices = new Set();
        while (indices.size < maxToRemove) indices.add(Math.floor(Math.random() * removeButtons.length));
        const toRemove = [...indices].map(i => removeButtons[i]);
        for (const btn of toRemove) {
          btn.click();
          await sleep(100);
          removed++;
        }
        logStep(`✓ Removed ${removed} excess skills (limit: 100)`);
      } else {
        logStep('✓ Skills within limit (≤100)');
      }
    } catch (e) { errors.push('Skills trim: ' + e.message); }

    await sleep(400);

    // ── STEP 5: SAP Sanction Consent checkbox ──
    try {
      let sanctionCB = null;
      // Try checkboxes
      for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
        const container = cb.closest('div[class], label, fieldset, tr') || cb.parentElement;
        const text = (container?.textContent || '').toLowerCase();
        if (text.includes('sanction') || text.includes('export control') || text.includes('screening')) {
          sanctionCB = cb;
          break;
        }
      }
      // Also try custom checkbox widgets (SAP sometimes uses role="checkbox")
      if (!sanctionCB) {
        for (const el of document.querySelectorAll('[role="checkbox"]')) {
          const text = (el.closest('div')?.textContent || el.textContent || '').toLowerCase();
          if (text.includes('sanction') || text.includes('screening')) {
            if (el.getAttribute('aria-checked') !== 'true') {
              el.click();
            }
            sanctionCB = el;
            logStep('✓ SAP Sanction consent checkbox ticked');
            break;
          }
        }
      }
      if (sanctionCB && sanctionCB.tagName === 'INPUT') {
        if (!sanctionCB.checked) {
          sanctionCB.click();
          sanctionCB.dispatchEvent(new Event('change', { bubbles: true }));
        }
        logStep('✓ SAP Sanction consent checkbox ticked');
      } else if (!sanctionCB) {
        logStep('Sanction checkbox not found on this page', false);
      }
    } catch (e) { errors.push('Sanction checkbox: ' + e.message); }

    await sleep(400);

    // ── STEP 6a: Legally authorized to work = Yes ──
    try {
      const done = await selectField('legally authorized', 'yes');
      logStep(done ? '✓ Legally authorized = Yes' : 'Auth dropdown not found on this page', done);
    } catch (e) { errors.push('Legally authorized: ' + e.message); }

    await sleep(500);

    // ── STEP 6b: Currently employed by = None of the Above ──
    try {
      const done = await selectField('currently employed', 'none of the above');
      logStep(done ? '✓ Currently employed = None of the Above' : 'Employment dropdown not found', done);
    } catch (e) { errors.push('Currently employed: ' + e.message); }

    await sleep(500);

    // ── STEP 6c: Previously employed by SAP = Yes ──
    try {
      const done = await selectField('previously employed', 'yes');
      logStep(done ? '✓ Previously employed by SAP = Yes' : 'Prev employed dropdown not found', done);
    } catch (e) { errors.push('Previously employed: ' + e.message); }

    await sleep(500);

    // ── STEP 7a: Country of residence = Germany ──
    try {
      let done = await selectField('country of residence', 'germany');
      if (!done) done = await selectField('country', 'germany');
      logStep(done ? '✓ Country of residence = Germany' : 'Country dropdown not found', done);
    } catch (e) { errors.push('Country: ' + e.message); }

    await sleep(500);

    // ── STEP 7b: Gender = Male ──
    try {
      let done = await selectField('your gender', 'male');
      if (!done) done = await selectField('gender', 'male');
      logStep(done ? '✓ Gender = Male' : 'Gender dropdown not found', done);
    } catch (e) { errors.push('Gender: ' + e.message); }

    await sleep(300);

    return { steps, errors };
  })();
}

// ---- Start ----
init();
