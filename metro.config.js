// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// `@matrix-org/olm/olm_legacy.js` contains branches that reference Node
// built-ins (`crypto`, `fs`, `path`) for its Node fallback. Those branches
// are guarded at runtime and never run on React Native, but Metro still
// statically resolves the `require()` calls during bundling, which fails
// because RN has no Node standard library. Redirect those specific
// requires to an empty stub so bundling succeeds. The matching Olm code
// paths are dead on-device, and on web Olm already takes the `window`
// branch before the stubbed requires are reached.
const emptyNodeModuleStub = path.resolve(
  __dirname,
  "app_directories/shims/emptyNodeModule.js",
);
const STUBBED_NODE_BUILTINS = new Set(["crypto", "fs", "path"]);
const OLM_LEGACY_PATH_FRAGMENT = path.join(
  "@matrix-org",
  "olm",
  "olm_legacy.js",
);

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    STUBBED_NODE_BUILTINS.has(moduleName) &&
    typeof context.originModulePath === "string" &&
    context.originModulePath.endsWith(OLM_LEGACY_PATH_FRAGMENT)
  ) {
    return { type: "sourceFile", filePath: emptyNodeModuleStub };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
