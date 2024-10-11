const isTypedArray = require("is-typed-array");
const path = require("path-browserify");

const { WASI, WASIExitError, WASIKillError } = require("./wasi");

const baseNow = Math.floor((Date.now() - performance.now()) * 1e-3);

function hrtime() {
  let clocktime = performance.now() * 1e-3;
  let seconds = Math.floor(clocktime) + baseNow;
  let nanoseconds = Math.floor((clocktime % 1) * 1e9);
  // return BigInt(seconds) * BigInt(1e9) + BigInt(nanoseconds)
  return seconds * 1e9 + nanoseconds;
}

function randomFillSync(buf, offset, size) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    // Similar to the implementation of `randomfill` on npm
    let uint = new Uint8Array(buf.buffer, offset, size);
    crypto.getRandomValues(uint);
    return buf;
  } else {
    try {
      // Try to load webcrypto in node
      let crypto = require("crypto");
      // TODO: Update to webcrypto in nodejs
      return crypto.randomFillSync(buf, offset, size);
    } catch {
      // If an error occurs, fall back to the least secure version
      // TODO: Should we throw instead since this would be a crazy old browser
      //       or nodejs built without crypto APIs
      if (buf instanceof Uint8Array) {
        for (let i = offset; i < offset + size; i++) {
          buf[i] = Math.floor(Math.random() * 256);
        }
      }
      return buf;
    }
  }
}

const defaultBindings = {
  hrtime: hrtime,
  exit(code) {
    throw new WASIExitError(code);
  },
  kill(signal) {
    throw new WASIKillError(signal);
  },
  randomFillSync: randomFillSync,
  isTTY: () => true,
  path: path,
  fs: null,
};

const defaultPreopens = {
  ".": ".",
  "/": "/",
};

class CircomRunner {
  constructor({
    args,
    env,
    preopens = defaultPreopens,
    bindings = defaultBindings,
    descriptors = undefined,
  } = {}) {
    if (!bindings.fs) {
      throw new Error(
        "You must specify an `fs`-compatible API as part of bindings",
      );
    }
    this.wasi = new WASI({
      args: ["circom2", ...args],
      env,
      preopens,
      bindings,
      descriptors,
    });
  }

  async compile(bufOrResponse) {
    // TODO: Handle ArrayBuffer
    if (isTypedArray(bufOrResponse)) {
      return WebAssembly.compile(bufOrResponse);
    }

    // Require Response object if not a TypedArray
    const response = await bufOrResponse;
    if (!(response instanceof Response)) {
      throw new Error("Expected TypedArray or Response object");
    }

    const contentType = response.headers.get("Content-Type") || "";

    if (
      "instantiateStreaming" in WebAssembly &&
      contentType.startsWith("application/wasm")
    ) {
      return WebAssembly.compileStreaming(response);
    }

    const buffer = await response.arrayBuffer();
    return WebAssembly.compile(buffer);
  }

  async execute(bufOrResponse) {
    const mod = await this.compile(bufOrResponse);
    const instance = await WebAssembly.instantiate(mod, {
      ...this.wasi.getImports(mod),
    });

    try {
      this.wasi.start(instance);
    } catch (err) {
      // The circom devs decided to start forcing an exit call instead of exiting gracefully
      // so we look for WASIExitError with success code so we can actually be graceful
      if (err instanceof WASIExitError && err.code === 0) {
        return instance;
      }

      throw err;
    }

    // Return the instance in case someone wants to access exports or something
    return instance;
  }
}

module.exports.CircomRunner = CircomRunner;
module.exports.preopens = defaultPreopens;
module.exports.bindings = defaultBindings;
