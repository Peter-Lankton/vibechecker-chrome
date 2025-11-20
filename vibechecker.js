"use strict";
var VibeCheckerCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    checkVibes: () => checkVibes,
    getFixPromptFor: () => getFixPromptFor
  });

  // src/rules/spookySecrets.ts
  function detectSpookySecrets(code) {
    const findings = [];
    const secretRegex = /(service_role|api[_-]?key|secret|token|password|passwd|client_secret|private[_-]?key)/i;
    const longKeyRegex = /['"`][A-Za-z0-9+/_=-]{32,}['"`]/;
    if (secretRegex.test(code) || longKeyRegex.test(code)) {
      findings.push({
        id: "SpookySecrets",
        ruleId: "SpookySecrets",
        severity: "cursed",
        title: "SpookySecrets: possible hard-coded secrets or credentials",
        detail: "We saw patterns that look like keys, tokens, or secrets directly in source. These should live in env/config or a secrets manager, not in code."
      });
    }
    return findings;
  }

  // src/rules/supabase.ts
  function detectSupabaseIssues(code) {
    const findings = [];
    const usesSupabase = /supabase\.co/.test(code) || /from\(["']users["']\)/.test(code);
    const hasServiceRole = /service_role/i.test(code) || /SERVICE_ROLE_KEY/.test(code) || /anon|service_role/i.test(code);
    const insertsReqBody = /\.from\(["'][^"']+["']\)\s*\.\s*insert\s*\(\s*req\.body/ims.test(code);
    if (usesSupabase && hasServiceRole) {
      findings.push({
        id: "SupabaseServiceRole",
        ruleId: "SupabaseServiceRole",
        severity: "cursed",
        title: "Supabase: service_role key likely exposed in app code",
        detail: "We saw a Supabase service_role-style key in code that looks like it could run in a browser or shared app environment. That key should only live in trusted server-side config."
      });
    }
    if (usesSupabase && insertsReqBody) {
      findings.push({
        id: "SupabaseBroadInsert",
        ruleId: "SupabaseBroadInsert",
        severity: "sus",
        title: "Supabase: inserting raw req.body into a table",
        detail: "We saw req.body inserted directly into a Supabase table. This can lead to over-permissive writes or unexpected data stored without validation."
      });
    }
    return findings;
  }

  // src/rules/privacyLogs.ts
  function detectPrivacyLogs(code) {
    const findings = [];
    const loggingRegex = /(console\.log|logger\.[a-z]+)\s*\([^)]*(email|password|token|ssn|social|address|phone|req\.body|user)/i;
    if (loggingRegex.test(code)) {
      findings.push({
        id: "PrivacyLogs",
        ruleId: "PrivacyLogs",
        severity: "sus",
        title: "Privacy: potentially sensitive data logged",
        detail: "We saw logging of request bodies or fields like email, password, tokens, or IDs. These can become privacy incidents if logs are exposed or retained too long."
      });
    }
    return findings;
  }

  // src/engine.ts
  function checkVibes(code) {
    const findings = [
      ...detectSpookySecrets(code),
      ...detectSupabaseIssues(code),
      ...detectPrivacyLogs(code)
    ];
    const level = computeVibeLevel(findings);
    const summary = buildSummary(level, findings);
    const topFinding = pickTopFinding(findings);
    return { level, findings, summary, topFinding };
  }
  function computeVibeLevel(findings) {
    if (!findings.length) return "chill";
    if (findings.some((f) => f.severity === "cursed")) return "cursed";
    if (findings.some((f) => f.severity === "sus")) return "sus";
    return "chill";
  }
  function buildSummary(level, findings) {
    if (!findings.length) {
      return "VibeLevel: chill. No obvious hard-coded secrets, risky Supabase usage, or privacy-unfriendly logs were detected.";
    }
    const labels = findings.map((f) => f.id).join(", ");
    return `VibeLevel: ${level}. Found: ${labels}.`;
  }
  function pickTopFinding(findings) {
    if (!findings.length) return null;
    const rank = { chill: 0, sus: 1, cursed: 2 };
    return findings.slice().sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0))[0];
  }

  // src/prompts.ts
  var FIX_PROMPTS = {
    SpookySecrets: `
You are a senior application security engineer.
The code I paste after this message was flagged by my VibeChecker tool as "SpookySecrets" which means it likely contains hard coded secrets, credentials, API keys, tokens, private keys, database passwords, or other sensitive values in source code or logs.

Your job:
1. Identify every SpookySecrets issue and treat any literal credential or sensitive value as unsafe.
2. Refactor the code to remove secrets from source and logs:
   - Use configuration or environment variables or a secrets manager instead of literals.
   - Never print or log secrets or full user sensitive data.
   - Do not invent real values. Use safe placeholders like YOUR_API_KEY or CONFIG.SECRET instead.
   - If the code runs in a browser, avoid exposing privileged keys client side and call out any remaining unavoidable risk.
3. Keep behavior the same apart from making it more secure.
4. Return:
   - The fully fixed code.
   - A short bullet list explaining each change and why it improves secret handling.

Here is the code to review and fix:
<PASTE CODE HERE>
`.trim(),
    SupabaseServiceRole: `
You are a senior application security engineer.
The code I paste after this message uses a Supabase service_role style key in application code.

Your job:
1. Identify every place where privileged Supabase keys are used in code that could run in a browser or multi-tenant environment.
2. Refactor so:
   - service_role keys only live in server-side config or environment variables.
   - browser and untrusted contexts use anon/public keys only.
   - any remaining privileged calls are wrapped in server-side APIs that perform proper auth and authorization.
3. Keep behavior the same apart from improving security.
4. Return:
   - The fixed code (or pseudo-code if it requires serverless functions or APIs).
   - A short list of changes and why they matter.

Here is the code to review and fix:
<PASTE CODE HERE>
`.trim(),
    SupabaseBroadInsert: `
You are a senior application security engineer.
The code I paste after this message performs Supabase inserts or updates using raw req.body data.

Your job:
1. Identify every Supabase query that uses req.body or other unvalidated input directly.
2. Refactor so:
   - Only expected fields are whitelisted and written.
   - Extra or unexpected fields from the client are ignored or rejected.
   - Any per-user data is correctly scoped to the authenticated user.
3. Keep behavior the same apart from making it more robust and secure.
4. Return:
   - The fixed code.
   - A short list of the key validation and authorization checks you added.

Here is the code to review and fix:
<PASTE CODE HERE>
`.trim(),
    PrivacyLogs: `
You are a senior privacy-aware application security engineer.
The code I paste after this message was flagged for logging potentially sensitive or personal data.

Your job:
1. Identify every log statement that includes request bodies, credentials, tokens, or user-identifying fields (email, phone, address, ID numbers, etc).
2. Refactor logging so:
   - Secrets and credentials are never logged.
   - Personal data is minimized, masked, or removed unless strictly necessary for debugging.
   - Logs avoid violating common privacy expectations under GDPR/CCPA/HIPAA and similar rules.
3. Keep behavior the same apart from safer logging.
4. Return:
   - The fixed code.
   - A short list of what you stopped logging or masked and why.

Here is the code to review and fix:
<PASTE CODE HERE>
`.trim()
  };
  var GENERIC_PROMPT = `
You are a senior application security engineer.
The code I paste after this message was flagged by my VibeChecker tool for security and privacy risks.

Your job:
1. Identify and explain the most important security or privacy issues.
2. Refactor the code to mitigate those issues while keeping behavior the same where possible.
3. Avoid logging or hard-coding secrets or personal data.
4. Return:
   - The fixed code.
   - A concise list of changes and why they matter.

Here is the code to review and fix:
<PASTE CODE HERE>
`.trim();
  function getFixPromptFor(ruleId) {
    return FIX_PROMPTS[ruleId] ?? GENERIC_PROMPT;
  }

  // src/index.ts
  if (typeof window !== "undefined") {
    window.VibeCheckerCore = window.VibeCheckerCore || {
      checkVibes,
      getFixPromptFor
    };
  }
  return __toCommonJS(index_exports);
})();
