// contentScript.js

console.log("[VibeChecker] content script loaded", location.href);

(function () {
    let pillEl = null;
    let overlayEl = null;
    let overlayPrompt = null;

    let lastSelectionText = "";
    let lastSelectionRect = null;

    // ---- Engine loading ----

    function hasCore() {
        const core = window.VibeCheckerCore;
        return (
            core &&
            typeof core.checkVibes === "function" &&
            typeof core.getFixPromptFor === "function"
        );
    }

    let coreLoadPromise = null;

    function loadCoreIfNeeded() {
        if (hasCore()) {
            console.log("[VibeChecker] core already present");
            return Promise.resolve(window.VibeCheckerCore);
        }

        if (!coreLoadPromise) {
            const url = chrome.runtime.getURL("vibechecker.js");
            console.log("[VibeChecker] importing engine from", url);
            coreLoadPromise = import(url)
                .then(() => {
                    console.log(
                        "[VibeChecker] engine import ok; VibeCheckerCore:",
                        window.VibeCheckerCore
                    );
                    if (!hasCore()) {
                        console.error(
                            "[VibeChecker] engine script ran but VibeCheckerCore is still missing"
                        );
                        return null;
                    }
                    return window.VibeCheckerCore;
                })
                .catch((err) => {
                    console.error("[VibeChecker] failed to import engine", err);
                    coreLoadPromise = null;
                    return null;
                });
        }

        return coreLoadPromise;
    }

    // ---- Pill + overlay helpers ----

    function clearPill() {
        if (pillEl && pillEl.parentNode) {
            pillEl.parentNode.removeChild(pillEl);
        }
        pillEl = null;
    }

    function showPill(rect) {
        if (!rect) return;

        if (!pillEl) {
            pillEl = document.createElement("button");
            pillEl.type = "button";
            pillEl.textContent = "Run VibeCheck";
            pillEl.setAttribute("data-vc-pill", "1");

            Object.assign(pillEl.style, {
                position: "fixed",          // top-right for now so it's always visible
                top: "20px",
                right: "20px",
                zIndex: "2147483647",
                padding: "6px 12px",
                borderRadius: "999px",
                border: "1px solid #0f766e",
                background: "#0f766e",
                color: "#ffffff",
                fontSize: "12px",
                fontFamily:
                    'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text","Inter","Segoe UI",sans-serif',
                boxShadow: "0 6px 14px rgba(15, 23, 42, 0.35)",
                cursor: "pointer",
            });

            pillEl.addEventListener("click", onPillClick, { passive: false });
            document.documentElement.appendChild(pillEl);

            console.log(
                "[VibeChecker] pill created, rect:",
                pillEl.getBoundingClientRect()
            );
        }
    }


    function clearOverlay() {
        if (overlayEl && overlayEl.parentNode) {
            overlayEl.parentNode.removeChild(overlayEl);
        }
        overlayEl = null;
        overlayPrompt = null;
    }

    async function copyOverlayPrompt() {
        if (!overlayPrompt) return;
        try {
            await navigator.clipboard.writeText(overlayPrompt);
            const btn = overlayEl && overlayEl.querySelector(".vc-overlay-copy-btn");
            if (!btn) return;
            const original = btn.textContent;
            btn.textContent = "Copied!";
            btn.classList.add("vc-overlay-copy-btn--copied");
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove("vc-overlay-copy-btn--copied");
            }, 1500);
        } catch (err) {
            console.error("VibeChecker: clipboard copy failed", err);
        }
    }

    function buildPrompt(core, analysis, code) {
        try {
            if (!analysis.topFinding) return null;
            const tpl = core.getFixPromptFor(analysis.topFinding.ruleId);
            if (!tpl) return null;

            if (tpl.indexOf("<PASTE CODE HERE>") !== -1) {
                return tpl.replace("<PASTE CODE HERE>", code);
            }
            return tpl + "\n\nHere is the code to review and fix:\n\n" + code;
        } catch (err) {
            console.error("VibeChecker: buildPrompt failed", err);
            return null;
        }
    }

    function showOverlay(analysis, prompt) {
        clearOverlay();

        overlayPrompt = prompt || null;
        overlayEl = document.createElement("div");
        overlayEl.className =
            "vc-overlay-root vc-overlay--" + (analysis.level || "chill");

        const level = analysis.level || "chill";
        const levelLabel =
            level === "cursed" ? "Cursed" : level === "sus" ? "Sus" : "Chill";

        let pointerLeft = "84%";
        let pointerColor = "#15803d";
        if (level === "cursed") {
            pointerLeft = "16%";
            pointerColor = "#b91c1c";
        } else if (level === "sus") {
            pointerLeft = "50%";
            pointerColor = "#b45309";
        }

        const summaryText =
            analysis.summary ||
            "VibeLevel check complete for your selected code snippet.";

        const findingsHtml =
            analysis.findings && analysis.findings.length
                ? `<ul class="vc-overlay-findings-list">
            ${analysis.findings
                    .map((f) => {
                        const title = f.title || f.id || f.ruleId;
                        const detail = f.detail || f.message || "";
                        return `
                  <li>
                    <strong>${title}</strong>
                    <span>${detail}</span>
                  </li>
                `;
                    })
                    .join("")}
          </ul>`
                : `<p class="vc-overlay-summary">
            No obvious SpookySecrets, risky Supabase patterns, or privacy-hostile logs found.
          </p>`;

        overlayEl.innerHTML = `
      <div class="vc-overlay-card">
        <div class="vc-overlay-header">
          <div class="vc-overlay-title-group">
            <div class="vc-overlay-pill">
              <span class="vc-overlay-pill-dot"></span>
              <span>VIBECHECKER</span>
            </div>
            <div class="vc-overlay-level">${levelLabel}</div>
          </div>
          <button class="vc-overlay-close" type="button" aria-label="Close VibeChecker">
            ×
          </button>
        </div>

        <div class="vc-overlay-track">
          <div class="vc-overlay-track-segment vc-overlay-track-cursed"></div>
          <div class="vc-overlay-track-segment vc-overlay-track-sus"></div>
          <div class="vc-overlay-track-segment vc-overlay-track-chill"></div>
          <div class="vc-overlay-pointer" style="left:${pointerLeft};background:${pointerColor};"></div>
        </div>

        <p class="vc-overlay-summary">${summaryText}</p>
        ${findingsHtml}

        <div class="vc-overlay-footer">
          <button class="vc-overlay-copy-btn" type="button"${
            overlayPrompt ? "" : " disabled"
        }>
            Copy fix prompt for top finding
          </button>
        </div>
      </div>
    `;

        document.documentElement.appendChild(overlayEl);

        const closeBtn = overlayEl.querySelector(".vc-overlay-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => clearOverlay());
        }

        const copyBtn = overlayEl.querySelector(".vc-overlay-copy-btn");
        if (copyBtn && overlayPrompt) {
            copyBtn.addEventListener("click", (e) => {
                e.preventDefault();
                copyOverlayPrompt();
            });
        }
    }

    // ---- Event handlers ----

    async function onPillClick(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!lastSelectionText || !lastSelectionText.trim()) {
            console.log("[VibeChecker] pill clicked but no selection");
            return;
        }

        const core = await loadCoreIfNeeded();
        if (!core) {
            console.error("[VibeChecker] core not available after loadCoreIfNeeded");
            return;
        }

        pillEl.disabled = true;
        pillEl.textContent = "Checking…";

        try {
            const analysis = core.checkVibes(lastSelectionText);
            const prompt = buildPrompt(core, analysis, lastSelectionText);
            showOverlay(analysis, prompt);
        } catch (err) {
            console.error("VibeChecker: checkVibes failed", err);
        } finally {
            pillEl.disabled = false;
            pillEl.textContent = "VibeCheck";
            clearPill();
        }
    }

    function isInsideOverlay(node) {
        if (!overlayEl || !node) return false;
        return overlayEl.contains(node);
    }

    function handleSelectionChange() {
        const sel = window.getSelection();
        const preview = sel && sel.toString().slice(0, 40);
        console.log("[VibeChecker] selectionchange:", preview);

        if (!sel || sel.isCollapsed) {
            return;
        }

        const text = sel.toString();
        if (!text || !text.trim() || text.trim().length < 8) {
            return;
        }

        let range;
        try {
            range = sel.getRangeAt(0);
        } catch {
            return;
        }

        if (isInsideOverlay(range.commonAncestorContainer)) {
            return;
        }

        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            return;
        }

        lastSelectionText = text;
        lastSelectionRect = rect;
        showPill(rect);
    }

    function debounce(fn, wait) {
        let t;
        return function () {
            const args = arguments;
            clearTimeout(t);
            t = setTimeout(() => fn.apply(null, args), wait);
        };
    }

    const debouncedSelectionHandler = debounce(handleSelectionChange, 120);

    document.addEventListener("selectionchange", debouncedSelectionHandler);
    document.addEventListener("mouseup", debouncedSelectionHandler);
})();
