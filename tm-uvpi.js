// ==UserScript==
// @name         Unified Verint Product Injector (UVPI)
// @description  This is a tampermonkey script to inject Verint products to any website.
// @author       Daniel Kahl
// @version      1.2
// @match        https://*/*
// @namespace    http://tampermonkey.net/
// @source       https://github.com/foreseecode/tm-scripts/blob/main/tm-uvpi.js
// @downloadURL  https://raw.githubusercontent.com/foreseecode/tm-scripts/refs/heads/main/tm-uvpi.js
// @updateURL    https://raw.githubusercontent.com/foreseecode/tm-scripts/refs/heads/main/tm-uvpi.js
// @grant        none
// ==/UserScript==

const injector = createInjector();
const isIframe = window.top != window.self;

// START RULES

// Example Unified WebSDK:
// injector.rule(/blank.org/, "unified-websdk", { siteKey: "default", container: "draft", moduleHost: ucm("us") });

// Example IVA:
// injector.rule(/blank.org/, "iva", { domain: "...", token: "...", hostname: "..." });

injector.rule(/blank.org/, "unified-websdk", { siteKey: "default", container: "draft", moduleHost: ucm("us") });
injector.rule(/blank.org/, "iva", {
  token: "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJ3b3Jrc3BhY2VJZCI6IjY1OWViYTk3M2ZlZTQxZDcwYWE4NjNmZiIsImlhdCI6MTcwNDkwMTI3MX0.ONyCn6YotO0o7YoStC-IVQtFOa4-YfiqE1UgpwgtgzQEqTWUz8d5jx1-WWrALbveiMSp1zh0tJmTRJkw3tOyiPrYkkGyK-kbO5sMAevCHsmaVYIEMhk8V5bh5Xb9SFmyT674ez-nl7yLj36QfMW9k2MCSC_q_qHd-yX9TAsItP_Q0Pug3dtkOWvb8Qglibs4iqSLbZZKSdJiOs-LmYtpDemDIppboYKcFXZ_q45gqpo1miZLULEWPgUL2DcRmO4wsmTGIvYdikaxyrXIv3Nd7VdQZulB38Unp_RN-WnJd0rv7fYo45rRltFU9OA6BlKuT62mjpPJLzd_DFe0HO1CRQ",
  domain: "https://messenger.ivastudio.verint.live",
  port: "443"
});

// END RULES

// START SCRIPTS

injector.script("unified-websdk", {
  defaultOptions: {
    varName: "unifiedSDK",
    container: "draft",
    moduleHost: ucm("us"),
    configHost: null, // null => use same as "moduleHost"
    version: null
  },
  inject({ version, ...siteConfig }) {

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
    token: null
  },
  inject({ domain, port, token }) {

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

      // generate options object from default and rule options
      const options = {
        blockIframe: true,
        ...script.defaultOptions,
        ...rule.options
      };

      // block iframe when configured or cleanup from option as its not needed by the inject function
      if (options.blockIframe && isIframe) return;
      delete options.blockIframe;

      success(`✅ Injecting "${rule.script}"...`);
      script.inject(options);
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
