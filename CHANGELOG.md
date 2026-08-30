# Changelog

All notable changes to this project are documented in this file.
Older versions are summarized in their respective GitHub releases.

## [2.4.0] - 2026-08-30

### Added

- **Thinking compatibility profiles** (`src/common/thinking-profiles.js`): a sustainable
  rule table that maps *provider + model* to the correct thinking parameters.
  Each rule supports: provider-id / endpoint-host matching, model globs, `off`
  parameters (or `null` when a model cannot disable thinking), effort `levels`
  with per-level request params, a custom-effort `effortParam` path, per-model
  `apiFormat`/`endpoint` overrides, and `requestOverrides` to patch or remove
  arbitrary body fields (e.g. `"temperature": null`).
  Priority: user rules > built-in rules > legacy default behavior.
- **Built-in profiles**, verified against live APIs:
  - OpenRouter: `reasoning: { enabled: false }` / `reasoning: { effort }`.
  - OpenCode Go: GLM (thinking cannot be disabled; low/high/max), DeepSeek
    (`reasoning_effort: none`), Qwen (`thinking: { type: 'disabled' }`), and a
    generic rule that also strips `temperature` for models that reject it (kimi).
  - Command Code: Claude models route to Anthropic `/messages` with
    `thinking.budget_tokens` levels, GPT models (default off,
    `reasoning_effort` low→max), DeepSeek (cannot be disabled).
- **New provider presets**: OpenCode Go and Command Code (aggregator group).
- Settings page: **custom thinking rules editor** — paste a JSON array of rules,
  validated and stored locally (included in WebDAV sync), plus a viewer for the
  built-in rules.

### Changed

- The thinking toggle in settings is now a switch instead of a checkbox.
- Reasoning effort options are generated dynamically from the active
  provider + model profile; models that cannot disable thinking show a warning
  and the toggle then sends no parameters.
- Ask now respects the per-config thinking toggle and effort level instead of
  always requesting "no thinking" in a fixed format.

### Fixed

- **OpenRouter**: disabling thinking now actually works — the previous
  `thinking: { type: 'disabled' }` body was ignored by OpenRouter, so hybrid
  models (DeepSeek V4 Flash, Qwen 3.7 Flash, …) kept reasoning. The unified
  `reasoning` parameter is used instead (verified: reasoning tokens drop to 0).
- **Anthropic-compatible endpoints**: thinking levels map to
  `thinking: { type: 'enabled', budget_tokens }` with `max_tokens` raised above
  the budget; "off" sends no thinking field (previously an OpenAI-style
  `thinking` object could be sent to Anthropic-shaped endpoints).
- **OpenCode Go kimi models**: the hardcoded `temperature` field is stripped per
  profile (upstream rejects it), which previously failed every request.
