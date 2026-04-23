// Stub for Node.js built-in modules (crypto, fs, path) that are referenced
// by `@matrix-org/olm/olm_legacy.js` in code paths that never execute at
// runtime on React Native. Metro still evaluates their `require()` calls
// during static analysis, so we point those requires at this empty module
// via `metro.config.js`. If any real consumer ever actually calls into this
// stub it will throw via `undefined` access, which is the correct behavior.
module.exports = {};
