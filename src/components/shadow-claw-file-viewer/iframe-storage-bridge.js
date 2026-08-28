/**
 * iframe-storage-bridge.js
 *
 * Injected into sandboxed preview iframes (via nonce-gated CSP) to provide
 * a transparent storage proxy when the iframe is running in an opaque origin
 * (i.e. sandbox without allow-same-origin).
 *
 * When IndexedDB and localStorage are unavailable due to opaque origin
 * restrictions, this bridge intercepts storage calls and proxies them to
 * the parent frame via postMessage.  The parent frame performs the actual
 * storage operations on the iframe's behalf using a namespaced key-value
 * store.
 *
 * SECURITY:
 *   - All messages use a unique type prefix to avoid collision.
 *   - The parent validates message source against the iframe's contentWindow.
 *   - Storage is namespaced per-page to prevent cross-page data leakage.
 *   - This file is served same-origin and loaded with a per-render nonce.
 */

(function () {
  "use strict";

  // Intercept and prevent unhandled sandboxed serviceWorker SecurityErrors from breaking execution flow
  try {
    window.addEventListener(
      "error",
      function (e) {
        if (
          e.message &&
          (e.message.indexOf("serviceWorker") !== -1 ||
            e.message.indexOf("Service worker") !== -1)
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    window.addEventListener(
      "unhandledrejection",
      function (e) {
        if (
          e.reason &&
          (String(e.reason).indexOf("serviceWorker") !== -1 ||
            String(e.reason).indexOf("Service worker") !== -1)
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  } catch (e) {}

  // Safely trap serviceWorker access in sandboxed cross-origin iframes
  try {
    var swDesc = {
      get: function () {
        return undefined;
      },
      configurable: true,
      enumerable: false,
    };
    if (typeof Navigator !== "undefined" && Navigator.prototype) {
      try {
        Object.defineProperty(Navigator.prototype, "serviceWorker", swDesc);
      } catch (e1) {}
    }
    if (typeof navigator !== "undefined") {
      try {
        Object.defineProperty(navigator, "serviceWorker", swDesc);
      } catch (e2) {}
    }
  } catch (e) {
    // ignore
  }

  // Safely trap caches (CacheStorage) access in sandboxed cross-origin iframes
  try {
    var cacheDesc = {
      get: function () {
        return undefined;
      },
      configurable: true,
      enumerable: false,
    };
    if (typeof Window !== "undefined" && Window.prototype) {
      try {
        Object.defineProperty(Window.prototype, "caches", cacheDesc);
      } catch (e1) {}
    }
    if (typeof window !== "undefined") {
      try {
        Object.defineProperty(window, "caches", cacheDesc);
      } catch (e2) {}
    }
  } catch (e) {
    // ignore
  }

  // Polyfill showOpenFilePicker using standard <input type="file"> in sandboxed iframes
  try {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: function (options) {
        return new Promise(function (resolve, reject) {
          var input = document.createElement("input");
          input.type = "file";
          if (options && options.multiple) {
            input.multiple = true;
          }
          if (options && options.types && options.types.length > 0) {
            var accept = [];
            options.types.forEach(function (t) {
              if (t.accept) {
                Object.keys(t.accept).forEach(function (mime) {
                  accept.push(mime);
                  var exts = t.accept[mime];
                  if (Array.isArray(exts)) {
                    exts.forEach(function (ext) {
                      accept.push(ext);
                    });
                  }
                });
              }
            });
            if (accept.length > 0) {
              input.accept = accept.join(",");
            }
          }

          input.onchange = function () {
            if (!input.files || input.files.length === 0) {
              reject(
                new DOMException("The user aborted a request.", "AbortError"),
              );
              return;
            }
            var handles = Array.from(input.files).map(function (file) {
              return {
                kind: "file",
                name: file.name,
                getFile: function () {
                  return Promise.resolve(file);
                },
              };
            });
            resolve(handles);
          };

          input.oncancel = function () {
            reject(
              new DOMException("The user aborted a request.", "AbortError"),
            );
          };

          input.click();
        });
      },
      configurable: true,
      writable: true,
    });
  } catch (e) {
    // ignore
  }

  // Polyfill showSaveFilePicker using standard <a download> in sandboxed iframes
  try {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: function (options) {
        var filename = (options && options.suggestedName) || "download";
        var mimeType = "application/octet-stream";
        if (
          options &&
          options.types &&
          options.types.length > 0 &&
          options.types[0].accept
        ) {
          var mimes = Object.keys(options.types[0].accept);
          if (mimes.length > 0) {
            mimeType = mimes[0];
          }
        }

        var chunks = [];

        var writable = {
          write: function (data) {
            if (
              data &&
              typeof data === "object" &&
              data.type === "write" &&
              data.data
            ) {
              chunks.push(data.data);
            } else if (data !== undefined && data !== null) {
              chunks.push(data);
            }
            return Promise.resolve();
          },
          seek: function () {
            return Promise.resolve();
          },
          truncate: function () {
            return Promise.resolve();
          },
          close: function () {
            return new Promise(function (resolve) {
              try {
                var blob = new Blob(chunks, { type: mimeType });
                var url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.style.display = "none";
                document.body.appendChild(a);
                a.click();
                setTimeout(function () {
                  if (a.parentNode) {
                    a.parentNode.removeChild(a);
                  }
                  URL.revokeObjectURL(url);
                }, 1000);
              } catch (e) {
                // ignore
              }
              resolve();
            });
          },
        };

        var handle = {
          kind: "file",
          name: filename,
          createWritable: function () {
            return Promise.resolve(writable);
          },
          getFile: function () {
            var blob = new Blob(chunks, { type: mimeType });
            var file = new File([blob], filename, { type: mimeType });
            return Promise.resolve(file);
          },
        };

        return Promise.resolve(handle);
      },
      configurable: true,
      writable: true,
    });
  } catch (e) {
    // ignore
  }

  // Always install proxy immediately for sandboxed preview iframes.
  installProxy();

  // ----------------------------------------------------------------
  // Pending request tracking
  // ----------------------------------------------------------------
  var pendingRequests = {};
  var requestIdCounter = 0;

  function sendRequest(method, args) {
    return new Promise(function (resolve, reject) {
      var requestId = "sc-storage-" + ++requestIdCounter;
      pendingRequests[requestId] = { resolve: resolve, reject: reject };
      window.parent.postMessage(
        {
          type: "shadow-claw-storage-proxy",
          requestId: requestId,
          method: method,
          args: args,
        },
        "*",
      );

      // Timeout after 10 seconds to avoid hanging forever.
      setTimeout(function () {
        if (pendingRequests[requestId]) {
          delete pendingRequests[requestId];
          reject(new Error("Storage proxy request timed out: " + method));
        }
      }, 10000);
    });
  }

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "shadow-claw-storage-proxy-result") {
      return;
    }
    var requestId = event.data.requestId;
    var pending = pendingRequests[requestId];
    if (!pending) {
      return;
    }
    delete pendingRequests[requestId];
    if (event.data.error) {
      pending.reject(new Error(event.data.error));
    } else {
      pending.resolve(event.data.result);
    }
  });

  // ----------------------------------------------------------------
  // localStorage shim
  // ----------------------------------------------------------------
  function installProxy() {
    // localStorage shim — backed by parent-proxied key-value store.
    var localStorageShim = {
      _cache: {},

      getItem: function (key) {
        // Return cached value synchronously (best-effort).
        // Async warm-up happens in the background.
        return this._cache[key] !== undefined ? this._cache[key] : null;
      },

      setItem: function (key, value) {
        var stringValue = String(value);
        this._cache[key] = stringValue;
        sendRequest("setItem", { key: key, value: stringValue }).catch(
          function () {
            // Silently ignore write failures
          },
        );
      },

      removeItem: function (key) {
        delete this._cache[key];
        sendRequest("removeItem", { key: key }).catch(function () {});
      },

      clear: function () {
        this._cache = {};
        sendRequest("clear", {}).catch(function () {});
      },

      key: function (index) {
        var keys = Object.keys(this._cache);
        return index >= 0 && index < keys.length ? keys[index] : null;
      },

      get length() {
        return Object.keys(this._cache).length;
      },
    };

    // Warm up the cache from the parent.
    sendRequest("getAllItems", {})
      .then(function (items) {
        if (items && typeof items === "object") {
          for (var k in items) {
            if (Object.prototype.hasOwnProperty.call(items, k)) {
              localStorageShim._cache[k] = items[k];
            }
          }
        }
      })
      .catch(function () {});

    try {
      Object.defineProperty(window, "localStorage", {
        get: function () {
          return localStorageShim;
        },
        configurable: true,
      });
    } catch (e) {
      // If we can't override localStorage, leave the native (broken) one.
    }

    // ----------------------------------------------------------------
    // IndexedDB shim — minimal proxy supporting open / transaction / objectStore CRUD
    // ----------------------------------------------------------------
    var IDBShimDatabase = function (name) {
      this.name = name;
      this._closed = false;
    };

    IDBShimDatabase.prototype.close = function () {
      this._closed = true;
    };

    IDBShimDatabase.prototype.transaction = function (storeNames) {
      return new IDBShimTransaction(this.name, storeNames);
    };

    // Expose objectStoreNames for compatibility (always returns the default store).
    Object.defineProperty(IDBShimDatabase.prototype, "objectStoreNames", {
      get: function () {
        return {
          length: 1,
          item: function () {
            return "__default__";
          },
          contains: function () {
            return true;
          },
        };
      },
    });

    var IDBShimTransaction = function (dbName, storeNames) {
      this._dbName = dbName;
      this._storeNames = storeNames;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;

      // Fire oncomplete asynchronously.
      var self = this;
      setTimeout(function () {
        if (typeof self.oncomplete === "function") {
          self.oncomplete({ target: self });
        }
      }, 0);
    };

    IDBShimTransaction.prototype.objectStore = function (name) {
      return new IDBShimObjectStore(this._dbName, name);
    };

    var IDBShimObjectStore = function (dbName, storeName) {
      this._dbName = dbName;
      this._storeName = storeName;
    };

    IDBShimObjectStore.prototype.get = function (key) {
      return createIDBRequest(
        sendRequest("idb-get", {
          dbName: this._dbName,
          storeName: this._storeName,
          key: key,
        }),
      );
    };

    IDBShimObjectStore.prototype.getAll = function () {
      return createIDBRequest(
        sendRequest("idb-getAll", {
          dbName: this._dbName,
          storeName: this._storeName,
        }),
      );
    };

    IDBShimObjectStore.prototype.put = function (value, key) {
      return createIDBRequest(
        sendRequest("idb-put", {
          dbName: this._dbName,
          storeName: this._storeName,
          key: key,
          value: value,
        }),
      );
    };

    IDBShimObjectStore.prototype.delete = function (key) {
      return createIDBRequest(
        sendRequest("idb-delete", {
          dbName: this._dbName,
          storeName: this._storeName,
          key: key,
        }),
      );
    };

    IDBShimObjectStore.prototype.clear = function () {
      return createIDBRequest(
        sendRequest("idb-clear", {
          dbName: this._dbName,
          storeName: this._storeName,
        }),
      );
    };

    IDBShimObjectStore.prototype.getAllKeys = function () {
      return createIDBRequest(
        sendRequest("idb-getAll", {
          dbName: this._dbName,
          storeName: this._storeName,
        }).then(function (items) {
          if (items && typeof items === "object") {
            return Object.keys(items);
          }
          return [];
        }),
      );
    };

    IDBShimObjectStore.prototype.openKeyCursor = function () {
      return this.openCursor();
    };

    IDBShimObjectStore.prototype.openCursor = function () {
      var request = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        readyState: "pending",
      };

      sendRequest("idb-getAll", {
        dbName: this._dbName,
        storeName: this._storeName,
      })
        .then(function (items) {
          var keys =
            items && typeof items === "object" ? Object.keys(items) : [];
          var index = 0;

          function advanceCursor() {
            if (index >= keys.length) {
              request.result = null;
              request.readyState = "done";
              if (typeof request.onsuccess === "function") {
                request.onsuccess({ target: request });
              }
              return;
            }

            var currentKey = keys[index];
            var currentValue = items[currentKey];

            var cursor = {
              key: currentKey,
              primaryKey: currentKey,
              value: currentValue,
              continue: function () {
                index++;
                advanceCursor();
              },
            };

            request.result = cursor;
            request.readyState = "done";
            if (typeof request.onsuccess === "function") {
              request.onsuccess({ target: request });
            }
          }

          advanceCursor();
        })
        .catch(function (err) {
          request.error = err;
          request.readyState = "done";
          if (typeof request.onerror === "function") {
            request.onerror({ target: request });
          }
        });

      return request;
    };

    function createIDBRequest(promise) {
      var request = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        readyState: "pending",
      };

      promise
        .then(function (result) {
          request.result = result;
          request.readyState = "done";
          if (typeof request.onsuccess === "function") {
            request.onsuccess({ target: request });
          }
        })
        .catch(function (err) {
          request.error = err;
          request.readyState = "done";
          if (typeof request.onerror === "function") {
            request.onerror({ target: request });
          }
        });

      return request;
    }

    // indexedDB.open() shim
    var indexedDBShim = {
      open: function (name) {
        var request = {
          result: null,
          error: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          readyState: "pending",
        };

        // Simulate async open.
        setTimeout(function () {
          request.result = new IDBShimDatabase(name);
          request.readyState = "done";

          // Fire onupgradeneeded first (for initial setup), then onsuccess.
          if (typeof request.onupgradeneeded === "function") {
            request.onupgradeneeded({
              target: request,
              oldVersion: 0,
              newVersion: 1,
            });
          }
          if (typeof request.onsuccess === "function") {
            request.onsuccess({ target: request });
          }
        }, 0);

        return request;
      },

      deleteDatabase: function (name) {
        var request = createIDBRequest(
          sendRequest("idb-deleteDatabase", { dbName: name }),
        );
        return request;
      },
    };

    try {
      Object.defineProperty(window, "indexedDB", {
        get: function () {
          return indexedDBShim;
        },
        configurable: true,
      });
    } catch (e) {
      // If we can't override, leave native.
    }
  }
})();
