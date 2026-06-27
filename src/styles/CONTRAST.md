Contrast audit summary
======================

This document captures the color contrast updates made to improve WCAG AA compliance.

- `--color-text-primary` on `--color-bg` (default): high contrast (>= 7:1)
- `--color-text-secondary` on `--color-bg`: updated to a darker tone to meet 4.5:1
- `--color-text-muted` on `--color-bg`: updated to meet large-text contrast (>= 3:1)
- Semantic colors adjusted: `--color-success`, `--color-warning`, `--color-error`, `--color-info` to more saturated/darker variants for badge and indicator legibility.

Developer notes
---------------
- Run an automated axe-core audit (e.g. the Playwright accessibility checks included in CI) to verify there are zero contrast violations.
- If you run the audit locally, ensure your environment uses the updated CSS by rebuilding the app.
