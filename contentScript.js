// contentScript.js

(function () {
    let rootEl = null;
    let storedPrompt = null;

    function removeOverlay() {
        if (rootEl && rootEl.parentNode) {
            rootEl.parentNode.removeChild(rootEl);
        }
        rootEl = null;
        storedPrompt = null;
    }

    async function copyPromptToClipboard() {
        if (!storedPrompt) return;
        try {
            await navigator.clipboard.writeText(storedPrompt);
            const btn = rootEl && rootEl.querySelector(".vc-overlay-copy-btn");
            if (!btn) return;
            const original = btn.textContent;
            btn.textContent = "Copied!";
            btn.classList.add("vc-overlay-copy-btn--copied");
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove("vc-overlay-copy-btn--copied");
            }, 1500);
        } catch (err) {
            console.error("VibeChecker overlay: clipboard copy failed", err);
        }
    }

    function showOverlay(analysis, prompt) {
        removeOverlay(); // reset if already present

        storedPrompt = prompt || null;

        rootEl = document.createElement("div");
        rootEl.className = "vc-overlay-root";

        const level = analysis.level || "chill";
        const label =
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

        const findingsHtml =
            analysis.findings && analysis.findings.length
                ? `<ul class="vc-overlay-findings">
            ${analysis.findings
                    .map((f) => {
                        const title = f.title || f.id || f.ruleId;
                        const detail = f.detail || f.message || "";
                        return `
                  <li>
                    <strong>${title}</strong><br />
                    <span>${detail}</span>
                  </li>
                `;
                    })
                    .join("")}
          </ul>`
                : `<p class="vc-overlay-summary">No obvious SpookySecrets, risky Supabase patterns, or privacy-hostile logs found.</p>`;

        const summaryText =
            analysis.summary ||
            "Security vibe check complete on your selected code snippet.";

        rootEl.innerHTML = `
      <div class="vc-overlay-card vc-overlay--${level}">
        <div class="vc-overlay-header">
          <div class="vc-overlay-title-group">
            <div class="vc-overlay-pill">
              <span class="vc-overlay-dot"></span>
              <span>VIBECHECKER</span>
            </div>
            <div class="vc-overlay-level">${label}</div>
          </div>
          <button class="vc-overlay-close" type="button" aria-label="Close VibeChecker overlay">×</button>
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
            storedPrompt ? "" : " disabled"
        }>
            Copy fix prompt for top finding
          </button>
        </div>
      </div>
    `;

        document.documentElement.appendChild(rootEl);

        const closeBtn = rootEl.querySelector(".vc-overlay-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => removeOverlay());
        }

        const copyBtn = rootEl.querySelector(".vc-overlay-copy-btn");
        if (copyBtn && storedPrompt) {
            copyBtn.addEventListener("click", (e) => {
                e.preventDefault();
                copyPromptToClipboard();
            });
        }
    }

    // Listen for messages from the popup
    chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
        if (!msg || msg.type !== "VIBECHECK_SHOW_OVERLAY") {
            return;
        }
        try {
            const { analysis, prompt } = msg;
            if (!analysis) return;
            showOverlay(analysis, prompt);
        } catch (err) {
            console.error("VibeChecker overlay error:", err);
        }
    });
})();
