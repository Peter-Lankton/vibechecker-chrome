# VibeChecker Chrome Extension

**VibeChecker** lets you run a local security vibe check on AI-generated code right where you’re working.

Highlight code on GitHub, ChatGPT, Supabase docs, or your editor’s web UI, click **Run VibeCheck**, and you’ll get:

- A **VibeLevel**: `chill`, `sus`, or `cursed`
- A short list of **findings** (VibeRules)
- A **copy-ready fix prompt** for the top finding you can paste straight into your AI helper

All analysis runs locally in your browser. Your code is not sent to a server.

---

## Works where you work 

- https://chat.openai.com,
- https://chatgpt.com,
- https://claude.ai
- https://replit.com,
- https://bolt.new,
- https://codesandbox.io,
- https://stackblitz.com,
- https://lovable.dev,
- https://v0.dev,
- https://supabase.com,
- https://console.supabase.com,-
- https://github.com,
- https://gist.github.com,
- https://raw.githubusercontent.com,
- https://gitlab.com,
- https://bitbucket.org,

### Not seeing a site?

- Open a PR on the 'manifest.json' file with the new sites you'd like to vibecheck as you work

## What it checks in v0

The extension uses the `@peter-lankton/vibechecker` core engine.

v0 includes VibeRules for:

- **SpookySecrets** – possible hard-coded secrets or credentials
- **SupabaseServiceRole** – Supabase `service_role`-style keys in app code
- **SupabaseBroadInsert** – inserting raw `req.body` into Supabase tables
- **PrivacyLogs** – logging potentially sensitive data (emails, tokens, IDs, etc.)

This is intentionally small and focused so it’s fast and easy to reason about.

---

## How to use

1. Install VibeChecker from the Chrome Web Store (coming soon).
2. Open any page that shows code (e.g. GitHub, a docs snippet, ChatGPT output).
3. **Select** the code you want to check.
4. Click the **Run VibeCheck** pill that appears near your selection.
5. Read the VibeLevel card that slides in:
   - Red = `cursed`
   - Yellow = `sus`
   - Green = `chill`
6. Click **“Copy fix prompt for top finding”** to copy a security prompt that:
   - Describes the issue
   - Asks your AI helper to refactor the code
   - Includes your selected code inline

Paste that prompt into ChatGPT, Claude, Cursor, etc., and let your AI friend clean up its own mess.

---

## Privacy

VibeChecker is designed to be **local-first**:

- The vibe engine runs in your browser as a content script.
- Selected code is only used in memory to compute a VibeLevel and generate a prompt.
- The extension does **not** send your code to a remote server or SaaS platform.
- Clipboard access is only used when you click **“Copy fix prompt for top finding”**.

If that ever changes, this README and the Chrome Web Store listing will be updated to say so.

---

## Development

This repo is the Chrome extension wrapper around the core engine:

- Core engine: [`@peter-lankton/vibechecker`](https://www.npmjs.com/package/@peter-lankton/vibechecker)
- This extension bundles the built engine as `vibechecker.js` and loads it from the content script.

### Local install

1. Clone the repo:

   ```bash
   git clone https://github.com/Peter-Lankton/vibechecker-chrome.git
   cd vibechecker-chrome
   ```

2. In Chrome, go to `chrome://extensions` and enable **Developer mode**.

3. Click **“Load unpacked”** and select the `vibechecker-chrome` folder.

4. Visit a page with code (e.g. a GitHub file), select some code, and click **Run VibeCheck**.

### Building the engine

The engine itself lives in the `vibechecker` package. If you’re working on new rules:

1. Make changes in the core repo.
2. Run its test suite.
3. Build the bundle (`vibechecker.js`) and copy it into this repo.
4. Reload the extension in Chrome.

---

## License

This project is licensed under the AGPL-3.0 license. See [LICENSE](./LICENSE) for details.

