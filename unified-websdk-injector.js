// ==UserScript==
// @name         Unified WebSDK Injector - 1.7
// @description  This is a tampermonkey script to inject the Unified WebSDK to any website.
// @author       Daniel Kahl
// @version      1.7
// @match        https://*/*
// @namespace    http://tampermonkey.net/
// @downloadURL  https://raw.githubusercontent.com/dantodev/uws-scripts/refs/heads/main/unified-websdk-injector.js
// @updateURL    https://raw.githubusercontent.com/dantodev/uws-scripts/refs/heads/main/unified-websdk-injector.js
// @grant        none
// ==/UserScript==

const sites = [];

/*
 * START: Sites Confiugration
 */

// sites.push({ url: /ftd.com/, siteKey: "ftd", container: "draft", moduleHost: host("us") });

/*
 * END: Sites Confiugration
 */

const defaultSite = {
    varName: "unifiedSDK",
    container: "draft",
    moduleHost: host("us"),
    configHost: null, // null => use same as "moduleHost"
    blockIframe: true,
    version: null,
};

const isIframe = window.top != window.self;

function runSiteDetection() {
    if (!isIframe) {
        console.log(`[Unified WebSDK Injector] Run Site Detection...`);
    }

    const site = sites.find((site) => {
        console.debug("[Unified WebSDK Injector] Check Site for injection:", site);
        return site?.url?.test(location.href);
    });

    if (site) {
        injectSite(site);
    } else if (!isIframe) {
        console.log("%c⚠️ [Unified WebSDK Injector] URL Missmatch", "color: yellow;");
    }
}

function injectSite(site) {
    const { url, blockIframe, version, ...config } = { ...defaultSite, ...site, loadTime: Date.now() };
    if (config.configHost === null) {
        config.configHost = config.moduleHost;
    }

    if (blockIframe && isIframe) {
        return;
    }

    console.log(`%c✔️ ${isIframe ? "[iframe] " : ""}[Unified WebSDK Injector] Injecting site`, "color: green;");
    console.debug("[Unified WebSDK Injector] Injected Site:", site);

    const readyCallbacks = [];

    let sdkPath = config.sdkPath;
    if (!sdkPath) {
        if (config.modulePath) {
            sdkPath = buildPath(config.modulePath, { ...config, file: "sdk.js" });
        } else if (version) {
            sdkPath = `//${config.moduleHost}/files/modules/unified-websdk/${version}/sdk.js`;
        } else {
            sdkPath = `//${config.moduleHost}/files/sites/${config.siteKey}/${config.container}/sdk.js`;
        }
    }

    window._vrntSdkInit = config;
    window.uwsReady = (callback) => (readyCallbacks.push(callback));
    import(sdkPath).then(() => window[config.varName].start(config, readyCallbacks));
}

function host(region = "us", env = "prod", cdn = false) {
    if (region === "local") return "localhost:8080";

    let subdomain = `ucm-${region}`;
    if (env !== "prod") {
        subdomain += `-${env}`;
    }

    let domain = cdn ? "verint-cdn.com" : "verint-api.com";
    return `${subdomain}.${domain}`;
}

function buildPath(pathTemplate, params) {
  return pathTemplate.replace(/\{([a-z]+)\}/gi, ($0, $1) => {
    return params[$1];
  });
}

runSiteDetection();

/*
CHANGELOG

v1.7
- support different main window variable name

v1.6
- support for selfhosting testing

v1.5
- bugfix for version config

v1.4
- bugfix: removed unsupported config keys before starting the SDK (version, url, blockIframe)

v1.3
- added support for versions
*/
