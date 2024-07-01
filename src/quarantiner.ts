/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

type ConfigOptions = {
    globals: {
        [name: string]: {
            type: 'function' | 'object';
        };
    };
};

type GlobalFunction = (...args: unknown[]) => unknown;
type WritableGlobalObject = {
    [property: string]: GlobalFunction;
};
type WrapperFunction = (
    parent: Window,
    self: Window,
    top: Window,
    window: Window,
) => void;

// Signature for the `globalThis.quarantiner(...)` entrypoint function.
type Entrypoint = (wrapper: WrapperFunction, config: ConfigOptions) => void;

const mainWindow = window;

// Type .contentWindow such that global functions may be called.
let writableSandboxWindow: WritableGlobalObject | null = null;

const sandboxeeSpecs: { src: string; onload: () => void }[] = [];

const getGlobal = (name: string) => {
    return (writableSandboxWindow as WritableGlobalObject)[name];
};

/*
 * Create a sandbox to execute JavaScript in, separate from the main browsing context.
 */
document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    iframe.addEventListener('load', () => {
        const contentWindow = iframe.contentWindow as Window;
        const contentDocument = iframe.contentDocument as Document;

        writableSandboxWindow =
            contentWindow as unknown as WritableGlobalObject;
        const sandboxWindow = contentWindow as Window & typeof globalThis;

        const proxySet = new Set();

        const proxyMap = new Map();
        const proxyValue = (target: object, property: string | symbol) => {
            const value = (target as { [name: string]: unknown })[
                property as string
            ];
            const proxiedValue = proxyMap.has(value)
                ? proxyMap.get(value)
                : value;

            // TODO: Cache bound methods in a separate WeakMap tree or similar(?).
            //       Modifications to .prototype will be lost at the moment.
            // TODO2: Actually the above shouldn't be an issue now, as the Proxy
            //        will handle routing .prototype lookups to the original function -
            //        need to test (!) but caching still required for perf.
            return typeof proxiedValue === 'function'
                ? new Proxy(proxiedValue, {
                      apply(
                          _target: unknown,
                          thisArg: unknown,
                          args: unknown[],
                      ): unknown {
                          return proxiedValue.apply(
                              proxySet.has(thisArg) ? target : thisArg,
                              args,
                          );
                      },
                  })
                : proxiedValue;
        };

        const createWindowProxy = (window: Window) => {
            const proxy = new Proxy(window, {
                get(target: Window, property: string | symbol): unknown {
                    return proxyValue(target, property);
                },
            });
            proxySet.add(proxy);

            return proxy;
        };

        const mainWindowProxy = createWindowProxy(mainWindow);
        const sandboxWindowProxy = createWindowProxy(sandboxWindow);

        const createDocumentProxy = (document: Document) => {
            const proxy = new Proxy(document, {
                get(target: object, property: string | symbol): unknown {
                    return proxyValue(target, property);
                },
            });
            proxySet.add(proxy);

            return proxy;
        };

        const mainDocumentProxy = createDocumentProxy(mainWindow.document);
        // It should not (easily) be possible to access the sandbox document.

        proxyMap.set(mainWindow, mainWindowProxy);
        proxyMap.set(sandboxWindow, sandboxWindowProxy);
        proxyMap.set(mainWindow.Array, sandboxWindow.Array);
        proxyMap.set(mainWindow.Boolean, sandboxWindow.Boolean);
        proxyMap.set(mainWindow.Number, sandboxWindow.Number);
        proxyMap.set(mainWindow.Object, sandboxWindow.Object);
        proxyMap.set(mainWindow.String, sandboxWindow.String);

        proxyMap.set(mainWindow.document, mainDocumentProxy);
        // Sandbox document should not (easily) be accessible - redirect to the main document's.
        proxyMap.set(sandboxWindow.document, mainDocumentProxy);

        const sandboxContextEntrypoint: Entrypoint = (
            wrapper: WrapperFunction,
        ): void => {
            wrapper(
                mainWindow.parent, // TODO: Sandbox `parent.Array.prototype` access etc.
                sandboxWindowProxy,
                mainWindow.top as Window, // TODO: Sandbox `top.Array.prototype` access etc.
                sandboxWindowProxy,
            );
        };

        writableSandboxWindow.quarantiner =
            sandboxContextEntrypoint as GlobalFunction;

        for (const sandboxeeSpec of sandboxeeSpecs) {
            const script = contentDocument.createElement('script');

            script.addEventListener('load', () => {
                sandboxeeSpec.onload();
            });

            script.src = sandboxeeSpec.src;

            contentDocument.body.appendChild(script);
        }
    });

    // iframe.srcdoc = '<html><head></head><body>Hello</body></html>';
    document.body.appendChild(iframe);
});

const mainContextEntrypoint: Entrypoint = (
    _wrapper: WrapperFunction,
    config: ConfigOptions,
): void => {
    const currentScript = document.currentScript ?? null;

    if (currentScript === null) {
        throw new Error('Quarantiner() :: No current script');
    }

    if (currentScript.nodeName !== 'SCRIPT') {
        throw new Error('Quarantiner() :: Not called from a script');
    }

    // Capture the src of the script, as we will need to load it again inside the sandbox iframe.
    const currentScriptSrc = (currentScript as HTMLScriptElement).src;

    let loaded = false;

    for (const globalName of Object.keys(config.globals)) {
        // Queue of calls to the global function before it is defined
        // by the code when run inside the sandbox, to be replayed when defined.
        const queue: unknown[][] = [];

        if (config.globals[globalName].type !== 'function') {
            throw new Error('Only functions supported for now');
        }

        sandboxeeSpecs.push({
            src: currentScriptSrc,
            onload() {
                loaded = true;

                const globalValue = getGlobal(globalName);

                for (const args of queue) {
                    globalValue(...args);
                }

                queue.length = 0;
            },
        });

        Object.defineProperty(mainWindow, globalName, {
            get() {
                return (...args: unknown[]) => {
                    if (loaded) {
                        getGlobal(globalName)(...args);
                    } else {
                        queue.push(args);
                    }
                };
            },

            set() {
                throw new Error(
                    `Quarantiner :: An attempt was made to overwrite proxied global ${globalName}`,
                );
            },
        });
    }
};

export default mainContextEntrypoint;
