# Prism RSS Reader - Release Walkthrough (v0.2.2)

## 🛡️ Security Audit & Hardening (v0.2.2)

A critical security review was conducted prior to release, resulting in version `0.2.2`.

### Vulnerabilities Addressed
1.  **XSS in Article Reader**: Malicious feeds could inject scripts via article titles or content.
2.  **XSS in Feed List**: Feed titles were being rendered insecurely.
3.  **URL Injection**: `formatValue` helper had a regex vulnerability allowing attribute breakout.
4.  **Dashboard XSS**: "Daily Mix" and "Keyword" chips were vulnerable to stored XSS from feed metadata.

### Patches Applied
-   **Global HTML Escaping**: Implemented `escapeHtml()` helper used for all user-generated text (titles, descriptions, feed names, dates).
-   **Content Sanitization**: Implemented `sanitizeHtml()` using `DOMParser` to strip `<script>`, `<iframe`, `<object>`, and `on*` attributes from article bodies while preserving safe formatting.
-   **Safe URL Handling**: Rewrote `formatValue` to escape URLs before creating `<a>` tags.
-   **Safe DOM Parsing**: Replaced insecure `innerHTML` usage with `DOMParser().parseFromString()` for text summary extraction.

## 📦 Final Package

The extension has been packaged for usage and store submission.

> **File:** `prism-reader-v0.2.2.zip`
> **Location:** `\\wsl.localhost\Ubuntu-24.04\home\shone\dev\XPC\edge\Prism-RSS-Reader\prism-reader-v0.2.2.zip`

## ✅ Verification Steps

1.  **Load Unpacked**:
    *   Open `chrome://extensions`
    *   Enable **Developer Mode**
    *   Click **Load unpacked**
    *   Select `Prism-RSS-Reader` folder.

2.  **Verify Version**:
    *   Ensure version number is **0.2.2**.

3.  **Security Test**:
    *   Subscribe to a feed.
    *   Open an article.
    *   Confirm no suspicious alerts or scripts execute.
    *   Confirm UI rendering is intact.

4.  **Store Submission**:
    *   Go to Chrome Web Store Dashboard.
    *   **Cancel** any previous submission (if v0.2.0/v0.2.1 is pending).
    *   **Upload** `prism-reader-v0.2.2.zip`.
    *   Submit for review.

## 📝 Recent Changes (v0.2.2)
-   Security: `escapeHtml` and `sanitizeHtml` added to `viewer.js`.
-   Security: `formatValue` regex fix.
-   Security: Dashboard renderers hardened.
-   Update: Manifest version bumped to `0.2.2`.
