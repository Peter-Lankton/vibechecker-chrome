// popup.js

(function () {
    const codeEl = document.getElementById("vibeCode");
    const runBtn = document.getElementById("runVibeCheck");
    const copyBtn = document.getElementById("copyFixPrompt");
    const resultEl = document.getElementById("vibeResult");

    let lastCode = "";
    let lastTopRuleId = null;

    if (!codeEl || !runBtn || !copyBtn || !resultEl) return;

    function ensureCore() {
        if (
            !window.VibeCheckerCore ||
            typeof window.VibeCheckerCore.checkVibes !== "function"
        ) {
            resultEl.innerHTML =
                '<p class="vibe-placeholder">Vibe engine not loaded. Check that vibechecker-core.js is present and loaded before popup.js.</p>';
            copyBtn.disabled = true;
            return false;
        }
        return true;
    }

    // Prefill from current selection when popup opens
    function prefillFromSelection() {
        if (!chrome.tabs || !chrome.scripting) return;

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) return;

            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    func: () => window.getSelection().toString(),
                },
                function (results) {
                    if (
                        chrome.runtime.lastError ||
                        !results ||
                        !results[0] ||
                        !results[0].result
                    ) {
                        return;
                    }
                    const selection = results[0].result;
                    if (selection && !codeEl.value.trim()) {
                        codeEl.value = selection;
                    }
                }
            );
        });
    }

    function renderResult(result) {
        const level = result.level || "chill";
        const vibeLabel =
            level === "cursed" ? "Cursed" : level === "sus" ? "Sus" : "Chill";

        const levelClass =
            level === "cursed"
                ? "vibe-result--cursed"
                : level === "sus"
                    ? "vibe-result--sus"
                    : "vibe-result--chill";

        let pointerLeft = "84%";
        let pointerColor = "#15803d";

        if (level === "cursed") {
            pointerLeft = "14%";
            pointerColor = "#b91c1c";
        } else if (level === "sus") {
            pointerLeft = "50%";
            pointerColor = "#b45309";
        }

        const findingsHtml =
            result.findings.length === 0
                ? '<p class="vibe-placeholder">No obvious SpookySecrets, risky Supabase patterns, or privacy-hostile logs found.</p>'
                : `<ul class="vibe-findings-list">
            ${result.findings
                    .map(function (f) {
                        const title = f.title || f.id || f.ruleId;
                        const detail = f.detail || f.message || "";
                        return `
                  <li>
                    <strong>${title}</strong><br/>
                    <span>${detail}</span>
                  </li>
                `;
                    })
                    .join("")}
          </ul>`;

        resultEl.innerHTML =
            `<div class="vibe-card-inner ${levelClass}">` +
            `  <div class="vibe-header-row">` +
            `    <div class="vibe-tag">` +
            `      <span class="vibe-tag-dot"></span>` +
            `      <span>${vibeLabel}</span>` +
            `    </div>` +
            `    <p class="vibe-summary-text">${result.summary}</p>` +
            `  </div>` +
            `  <div class="vibe-track">` +
            `    <div class="vibe-track-segment vibe-track-cursed"></div>` +
            `    <div class="vibe-track-segment vibe-track-sus"></div>` +
            `    <div class="vibe-track-segment vibe-track-chill"></div>` +
            `    <div class="vibe-pointer" style="left:${pointerLeft};background:${pointerColor};"></div>` +
            `  </div>` +
            `  <div class="vibe-findings">${findingsHtml}</div>` +
            `</div>`;
    }

    function sendOverlayToActiveTab(analysis, code) {
        if (!chrome.tabs || !chrome.tabs.query) return;

        let prompt = null;
        try {
            const core = window.VibeCheckerCore;
            if (
                core &&
                typeof core.getFixPromptFor === "function" &&
                analysis.topFinding
            ) {
                const tpl = core.getFixPromptFor(analysis.topFinding.ruleId);
                if (tpl) {
                    prompt =
                        tpl.indexOf("<PASTE CODE HERE>") !== -1
                            ? tpl.replace("<PASTE CODE HERE>", code)
                            : tpl + "\n\nHere is the code to review and fix:\n\n" + code;
                }
            }
        } catch (err) {
            console.error("VibeChecker popup: failed to build prompt for overlay", err);
        }

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) return;

            chrome.tabs.sendMessage(
                tab.id,
                {
                    type: "VIBECHECK_SHOW_OVERLAY",
                    analysis: analysis,
                    prompt: prompt,
                },
                function () {
                    // Ignore errors when there is no content script on the page
                    const err = chrome.runtime.lastError;
                    if (
                        err &&
                        err.message &&
                        !err.message.includes("Receiving end does not exist")
                    ) {
                        console.warn("VibeChecker popup: sendMessage error", err.message);
                    }
                }
            );
        });
    }

    runBtn.addEventListener("click", function (event) {
        event.preventDefault();

        if (!ensureCore()) return;

        const code = codeEl.value || "";
        if (!code.trim()) {
            resultEl.innerHTML =
                '<p class="vibe-placeholder">Paste some AI-generated code first, then run a VibeCheck.</p>';
            copyBtn.disabled = true;
            lastCode = "";
            lastTopRuleId = null;
            return;
        }

        try {
            const { checkVibes } = window.VibeCheckerCore;
            const analysis = checkVibes(code);

            renderResult(analysis);

            lastCode = code;
            lastTopRuleId = analysis.topFinding
                ? analysis.topFinding.ruleId
                : null;

            if (lastTopRuleId) {
                copyBtn.disabled = false;
                copyBtn.textContent = "Copy fix prompt for top finding";
            } else {
                copyBtn.disabled = true;
            }

            // NEW: push an inline overlay into the active tab
            sendOverlayToActiveTab(analysis, code);
        } catch (err) {
            console.error("VibeCheck error:", err);
            resultEl.innerHTML =
                '<p class="vibe-placeholder">Something went wrong running this VibeCheck. Your code stayed in this popup.</p>';
            copyBtn.disabled = true;
            lastCode = "";
            lastTopRuleId = null;
        }
    });

    copyBtn.addEventListener("click", async function (event) {
        event.preventDefault();
        if (!ensureCore()) return;
        if (!lastCode || !lastTopRuleId) return;

        const { getFixPromptFor } = window.VibeCheckerCore;
        const template = getFixPromptFor(lastTopRuleId);

        let fullPrompt;
        if (template.indexOf("<PASTE CODE HERE>") !== -1) {
            fullPrompt = template.replace("<PASTE CODE HERE>", lastCode);
        } else {
            fullPrompt =
                template +
                "\n\nHere is the code to review and fix:\n\n" +
                lastCode;
        }

        try {
            await navigator.clipboard.writeText(fullPrompt);
            const original = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            copyBtn.classList.add("btn-vibe-copy--copied");
            setTimeout(function () {
                copyBtn.textContent = original;
                copyBtn.classList.remove("btn-vibe-copy--copied");
            }, 1500);
        } catch (err) {
            console.error("Clipboard copy failed:", err);
        }
    });

    // Init
    if (ensureCore()) {
        prefillFromSelection();
    }
})();