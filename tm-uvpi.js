// ==UserScript==
// @name         Unified Verint Product Injector (UVPI)
// @description  This is a tampermonkey script to inject Verint products to any website.
// @author       Daniel Kahl
// @version      1.1
// @match        https://*/*
// @namespace    http://tampermonkey.net/
// @downloadURL  https://raw.githubusercontent.com/foreseecode/tm-scripts/refs/heads/main/tm-uvpi.js
// @updateURL    https://raw.githubusercontent.com/foreseecode/tm-scripts/refs/heads/main/tm-uvpi.js
// @grant        none
// ==/UserScript==

const injector = createInjector();
const isIframe = window.top != window.self;

// START RULES

// Example Unified WebSDK:
// injector.rule(/blank.org/, "unified-websdk", { siteKey: "example-com", container: "draft", moduleHost: ucm("us") });

// Example IVA:
// injector.rule(/blank.org/, "iva", { token: "..." });

// END RULES

// START SCRIPTS

injector.script("unified-websdk", {
  defaultOptions: {
    varName: "unifiedSDK",
    container: "draft",
    moduleHost: ucm("us"),
    configHost: null, // null => use same as "moduleHost"
    version: null,
    blockIframe: true
  },
  inject({ blockIframe, version, ...siteConfig }) {
    if (blockIframe && isIframe) {
      return;
    }

    siteConfig.loadTime = Date.now();
    if (siteConfig.configHost === null) {
      siteConfig.configHost = siteConfig.moduleHost;
    }

    const readyCallbacks = [];
    let sdkPath = siteConfig.sdkPath;

    if (!sdkPath) {
      if (siteConfig.modulePath) {
        sdkPath = buildPath(siteConfig.modulePath, { ...siteConfig, file: "sdk.js" });
      } else if (version) {
        sdkPath = `//${siteConfig.moduleHost}/files/modules/unified-websdk/${version}/sdk.js`;
      } else {
        sdkPath = `//${siteConfig.moduleHost}/files/sites/${siteConfig.siteKey}/${siteConfig.container}/sdk.js`;
      }
    }

    window._vrntSdkInit = siteConfig;
    window.uwsReady = (callback) => readyCallbacks.push(callback);
    import(sdkPath).then(() => window[siteConfig.varName].start(siteConfig, readyCallbacks));
  }
});

injector.script("iva", {
  defaultOptions: {
    domain: "https://messenger.ivastudio.verint.live",
    port: "443",
    token: null,
    blockIframe: true
  },
  inject({ blockIframe, domain, port, token }) {
    if (blockIframe && isIframe) {
      return;
    }

    window.ivasMessengerSettings = { domain, port, token };

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = `${domain}:${port}/loader`;

    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }
});

// END SCRIPTS

injector.run();

// FUNCTIONS

function createInjector() {
  const rules = [];
  const scripts = {};
  const injector = {};

  injector.rule = function (url, script, options) {
    rules.push({ url, script, options });
  };

  injector.script = function (name, { defaultOptions = {}, inject }) {
    if (typeof inject !== "function") {
      error(`Script "${name}" has no valid inject function.`);
      return;
    }
    scripts[name] = { defaultOptions, inject };
  };

  injector.run = function () {
    if (!isIframe) {
      info(`Run Injection...`);
    }

    for (const rule of rules) {
      if (!isIframe) debug("Check rule:", rule);
      if (!rule?.url?.test(location.href)) {
        continue;
      }

      const script = scripts[rule.script];
      if (!script) {
        error(`Script "${rule.script}" not registered.`);
        continue;
      }

      success(`✅ Injecting "${rule.script}"...`);
      script.inject({ ...script.defaultOptions, ...rule.options });
    }
  };

  return injector;
}

function ucm(region = "us", env = "prod", cdn = false) {
  if (region === "local") return "localhost:8080";

  const domain = cdn ? "verint-cdn.com" : "verint-api.com";
  let subdomain = `ucm-${region}`;

  if (env !== "prod") {
    subdomain += `-${env}`;
  }

  return `${subdomain}.${domain}`;
}

function buildPath(pathTemplate, params) {
  return pathTemplate.replace(/\{([a-z]+)\}/gi, ($0, $1) => {
    return params[$1];
  });
}

function warn(...args) { logFactory("warn", "yellow", ...args); }
function error(...args) { logFactory("error", "red", ...args); }
function info(...args) { logFactory("info", "cyan", ...args); }
function debug(...args) { logFactory("log", "gray", ...args); }
function success(...args) { logFactory("log", "green", ...args); }

function logFactory(level, color, msg, ...rest) {
  const args = [];

  if (isIframe) {
    args.push(`%c[UVPI - IFRAME]%c ${msg}`);
  } else {
    args.push(`%c[UVPI] %c${msg}`);
  }
  args.push(`color: ${color}; font-weight: bold;`);
  args.push(`color: ${color};`);

  console[level](...args, ...rest);
}
