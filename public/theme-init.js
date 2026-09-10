/* No-flash theme bootstrap — external file (public/theme-init.js).
 *
 * It lives in its own file (instead of an inline <script> in index.html)
 * so production can ship a strict Content-Security-Policy of
 * `script-src 'self'` with no 'unsafe-inline' — an inline bootstrap script
 * would force 'unsafe-inline' (or a nonce) into the CSP, which weakens the
 * app's main XSS mitigation.
 *
 * Must run before React paints (see the synchronous <script> tag in
 * index.html). It only reads localStorage and matchMedia and touches the
 * <html> class — no network, no cookies, no side effects beyond the class
 * and color-scheme so the first paint is already in the right theme.
 */
(function () {
  try {
    var k = 'cashiea-theme';
    var s = localStorage.getItem(k);
    var t =
      s === 'light' || s === 'dark'
        ? s
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
    if (t === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = t;
  } catch (e) {
    // Storage blocked (private mode, tracking protection) — default dark.
    document.documentElement.classList.add('dark');
  }
})();
