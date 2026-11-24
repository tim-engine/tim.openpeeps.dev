// Tim Engine — browser/Node.js glue for build/tim.wasm (wasm32, no backend).
//
// The module is `--os:linux` + WASI libc with all OS imports satisfied by
// this minimal shim. The engine itself never touches the filesystem,
// network or clocks on the wasm path; the shims only exist so the module
// instantiates and libc startup succeeds.
//
// Universal module: `require('./tim.js')` in Node.js, or
// `<script src="tim.js">` + `TimWasm.loadTimUrl(url)` in the browser.

(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    global.TimWasm = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ERRNO_SUCCESS = 0;
  const ERRNO_BADF = 8;

  function makeWasi(getBuffer) {
    const view = () => new DataView(getBuffer());
    const u8 = () => new Uint8Array(getBuffer());

    const iovsSize = (iovs, iovsLen) => {
      let total = 0;
      for (let i = 0; i < iovsLen; i++) {
        total += view().getUint32(iovs + i * 8 + 4, true);
      }
      return total;
    };

    return {
      // Wall clock for wasi-libc internals. The engine never asks for time;
      // Date.now keeps libc init paths honest.
      clock_time_get: (clockId, precision, outPtr) => {
        const ns = BigInt(Date.now()) * 1000000n;
        view().setBigUint64(outPtr, ns, true);
        return ERRNO_SUCCESS;
      },
      fd_write: (fd, iovs, iovsLen, nwrittenPtr) => {
        // Discard guest stdout/stderr (engine diagnostics travel through
        // cliutils.logHook into the result buffer instead).
        view().setUint32(nwrittenPtr, iovsSize(iovs, iovsLen), true);
        return ERRNO_SUCCESS;
      },
      fd_read: () => ERRNO_BADF,
      fd_close: () => ERRNO_SUCCESS,
      fd_seek: () => ERRNO_BADF,
      fd_pread: () => ERRNO_BADF,
      fd_fdstat_get: () => ERRNO_BADF,
      fd_fdstat_set_flags: () => ERRNO_BADF,
      fd_filestat_get: () => ERRNO_BADF,
      // No preopened directories in the playground.
      fd_prestat_get: () => ERRNO_BADF,
      fd_prestat_dir_name: () => ERRNO_BADF,
      path_open: () => ERRNO_BADF,
      // Real randomness for `randomize()`/shuffle via the host CSPRNG
      // (globalThis.crypto exists in browsers and modern Node.js).
      random_get: (ptr, len) => {
        const out = u8().subarray(ptr, ptr + len);
        globalThis.crypto.getRandomValues(out);
        return ERRNO_SUCCESS;
      },
      proc_exit: (code) => { throw new Error('tim.wasm proc_exit(' + code + ')'); },
    };
  }

  async function instantiate(bytes) {
    const mod = new WebAssembly.Module(bytes);
    let memory = null;
    const wasi = makeWasi(() => memory.buffer);
    // Proxy: tolerate any extra WASI import by failing closed (BADF),
    // so future SDK additions don't break the shim.
    const imports = new Proxy(wasi, {
      get: (t, p) => (p in t ? t[p] : () => ERRNO_BADF),
    });
    const instance = new WebAssembly.Instance(mod, {
      wasi_snapshot_preview1: imports,
    });
    memory = instance.exports.memory;
    // Run libc constructors, then Nim's runtime init (idempotent).
    if (instance.exports.__wasm_call_ctors) instance.exports.__wasm_call_ctors();
    instance.exports.NimMain();

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    function writeStr(s) {
      const encoded = enc.encode(s);
      const ptr = instance.exports.timAlloc(encoded.length);
      new Uint8Array(memory.buffer).set(encoded, ptr);
      return [ptr, encoded.length];
    }
    function readResult() {
      const ptr = instance.exports.timResultPtr();
      const len = instance.exports.timResultLen();
      if (!ptr || !len) return '';
      return dec.decode(new Uint8Array(memory.buffer).slice(ptr, ptr + len));
    }
    function call(fn, ...strings) {
      const args = [];
      try {
        for (const s of strings) {
          const [ptr, len] = writeStr(s);
          args.push(ptr, len);
        }
        const code = fn(...args);
        const out = readResult();
        return { code, out };
      } finally {
        for (let i = 0; i < args.length; i += 2) instance.exports.timFree(args[i]);
      }
    }

    return {
      instance,
      version: () => call(instance.exports.timVersionInfo),
      render: (view, layout, partials, data) =>
        call(instance.exports.timRender, view, layout, partials, data),
      renderView: (view, partials, data) =>
        call(instance.exports.timRenderView, view, partials, data),
      transpile: (src, target, data = '') =>
        call(instance.exports.timTranspile, src, target, data),
      prettyPrint: (html) =>
        call(instance.exports.timPrettyPrint, html),
    };
  }

  // Node.js: load from a file path.
  async function loadTim(wasmPath) {
    if (wasmPath === undefined) {
      const path = require('path');
      // bindings/wasm/tim.js -> repo/build/tim.wasm
      wasmPath = path.join(__dirname, '..', '..', 'build', 'tim.wasm');
    }
    const fs = require('fs');
    return instantiate(fs.readFileSync(wasmPath));
  }

  // Browser: load from a URL.
  async function loadTimUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch ' + url + ': ' + res.status);
    return instantiate(await res.arrayBuffer());
  }

  const api = { instantiate, loadTim, loadTimUrl };

  // Node.js self-test: `node tim.js`.
  if (typeof require === 'function' && typeof module !== 'undefined' &&
      require.main === module) {
    (async () => {
      const tim = await loadTim();
      console.log('version:', JSON.stringify(tim.version()));
      const view = 'h1: "Hello, " & $this["name"]';
      console.log('render:', JSON.stringify(
        tim.renderView(view, '{}', '{"name": "WASM"}')));
    })().catch((e) => { console.error(e); process.exit(1); });
  }

  return api;
}));
