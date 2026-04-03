# SAP SuccessFactors AutoFill — Chrome Extension

A Chrome extension that automates filling job application forms on **SAP SuccessFactors** career portals (`career5.successfactors.eu`). Saves time when applying to multiple positions by auto-selecting dropdowns, ticking checkboxes, and trimming excess skills — all in a few clicks.

---

## Features

| Feature | Description |
|---|---|
| **Skill Trimming** | Detects skill tags on the page and removes random extras to stay within the 100-skill limit |
| **Sanction Checkbox** | Automatically ticks the SAP Sanction Party Screening / Export Control consent checkbox |
| **Employment Dropdowns** | Sets *Legally authorized to work* → **Yes**, *Currently employed by* → **None of the Above**, *Previously employed by SAP* → **Yes** |
| **Additional Info** | Sets *Country of residence* → **Germany**, *Gender* → **Male** |
| **Floating Buttons** | Two on-page buttons (Skills / Auto Fill) for manual control directly on the SAP form |
| **Popup UI** | Dark-themed extension popup with skills preview, form fill, DOM debug, and real-time logs |

## How It Works

1. **Open** a job application on any SAP SuccessFactors page.
2. **Two floating buttons** appear at the bottom-right of the page:
   - **🏷️ Skills (trim to 100)** — Click first if you have >100 skills. Removes random excess skill tags.
   - **⚡ Auto Fill** — Fills all dropdowns and ticks the sanction checkbox.
3. Alternatively, open the **extension popup** and use the buttons there (Extract Skills, Auto-Fill Form, Debug DOM).

### Dropdown Selection Strategy

The extension uses a multi-strategy approach to reliably match SAP's form fields:

1. **`findAndSetGlobalSelect`** — Scans all `<label>` elements for matching text, follows `for` attributes to `<select>` targets, and walks up 3 DOM levels from each select checking direct text nodes and child labels.
2. **`findFieldContainer`** — Locates the field container by label text, walking up to 6 ancestors to find one containing a form control.
3. **`tryRadioButtons`** — Handles radio-style inputs and SAP custom radio widgets (`role="radio"`).
4. **`tryCustomDropdown`** — Opens and selects from custom dropdown overlays, comboboxes, and listboxes with search/filter support.
5. **4-pass option matching** — Exact → word-boundary regex → starts-with → substring. Word-boundary matching prevents "Female" from matching "Male".

## Installation

1. Clone or download this repository:
   ```
   git clone https://github.com/ravalvarun-SAP/sap-autofill-extension.git
   ```
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `sap-autofill-extension` folder
5. Navigate to a SuccessFactors job application page — the floating buttons will appear automatically

## Project Structure

```
sap-autofill-extension/
├── manifest.json      # Chrome Extension Manifest V3 configuration
├── content.js         # Content script — floating buttons, skill trimming, auto-fill logic
├── popup.html         # Extension popup UI (dark theme)
├── popup.js           # Popup logic — skills preview, form fill via scripting API, DOM debug
├── background.js      # Service worker for auto-continue relay after page reloads
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### File Responsibilities

| File | Role |
|---|---|
| **manifest.json** | MV3 config. Permissions: `activeTab`, `scripting`, `storage`, `tabs`. Host permissions scoped to `*.successfactors.eu/com` only. Content script injected at `document_idle` in all frames. |
| **content.js** | Injected into every SAP SF page. Provides: floating action buttons, `trimSkills()`, `autoFillForm()` with full dropdown/checkbox logic, toast notifications, skill tag detection, and DOM inspection for popup messages. |
| **popup.js** | Runs in the extension popup. Contains 100 hardcoded skills, skills preview rendering, and `fillApplicationForm()` (injected via `chrome.scripting.executeScript`) with the same multi-strategy dropdown logic. |
| **popup.html** | Dark-themed popup with collapsible sections: skills list, form settings display, action buttons (Extract Skills, Auto-Fill Form, Debug DOM), progress bar, and log area. |
| **background.js** | Service worker that listens for `autoContinueFill` messages and injects `fillRemainingSteps()` after page reloads caused by skill removal. |

## Technical Details

- **Platform**: Chrome Extension Manifest V3
- **Target**: SAP SuccessFactors career portals (`career5.successfactors.eu`, `*.successfactors.eu`, `*.successfactors.com`)
- **DOM Interaction**: Native `<select>` elements, `input[type="checkbox"]`, `role="checkbox"`, custom dropdown overlays
- **Event Dispatch**: Uses both direct `.value` assignment and `Object.getOwnPropertyDescriptor` prototype setter to ensure React/Angular/SAP UI5 frameworks detect the change
- **Security**: No `innerHTML` with unsanitized content, permissions scoped to SuccessFactors domains only, no `<all_urls>`

## Form Fields Automated

| Section | Field | Value |
|---|---|---|
| Employment Information | Legally authorized to work in the country | **Yes** |
| Employment Information | Currently employed by | **None of the Above** |
| Employment Information | Previously employed by SAP | **Yes** |
| Additional Information | Country of residence | **Germany** |
| Additional Information | Gender | **Male** |
| Consent | SAP Sanction Party Screening | **✓ Checked** |
| Skills | Trim to ≤100 | Random excess removed |

## Known Considerations

- **Page Refresh**: Removing skills may trigger a page reload on some SAP forms. Use the Skills button first, wait for the page to reload, then click Auto Fill.
- **Gender Matching**: Uses word-boundary regex (`\bmale\b`) to prevent "Female" from being selected when "Male" is intended.
- **Long Labels**: SAP gender field labels can be ~250+ characters. The extension handles this without text-length filters.
- **Frame Support**: Content script runs in `all_frames: true` to handle SAP's iframe-based layouts.

## Report Summary

### What Was Built
A Chrome extension to automate repetitive SAP SuccessFactors job application form filling, targeting the employment information section, additional information section, consent checkbox, and skills management.

### Challenges Solved
1. **SAP DOM Structure** — Labels are deeply nested; standard `label[for]` doesn't always work. Solved with a 5-strategy field location approach.
2. **Male/Female Confusion** — `"female".includes("male")` returns `true`. Solved with word-boundary regex matching.
3. **Page Reload on Skill Removal** — Removing skills refreshes the page, destroying script state. Solved by splitting into two manual buttons (Skills → Auto Fill).
4. **Framework Event Detection** — SAP UI5 doesn't respond to simple `.value` changes. Solved by using prototype setter + dispatching both `input` and `change` events.
5. **Long Label Text** — Gender field label is ~250 chars. Removed restrictive text-length filters.
6. **False Matches** — Walking too many DOM levels matched the wrong `<select>`. Limited ancestor walk to 3 levels with single-select guards.

### Security Measures
- No use of `innerHTML` with user/page-sourced content (XSS prevention)
- Permissions scoped to SuccessFactors domains only (no `<all_urls>`)
- `CSS.escape()` used for dynamic CSS selectors (injection prevention)
- No sensitive data stored or transmitted

---

**Author**: Varun Raval  
**Repository**: [github.com/ravalvarun-SAP/sap-autofill-extension](https://github.com/ravalvarun-SAP/sap-autofill-extension)  
**Version**: 1.0.0  
**License**: MIT
