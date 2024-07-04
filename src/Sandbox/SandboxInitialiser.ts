/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox';
import SandboxDeclaration from './SandboxDeclaration';

export default class SandboxInitialiser {
    public constructor(
        private readonly mainWindow: Window & typeof globalThis,
        private readonly getSandbox: SandboxGetter,
    ) {}

    /**
     * Sets up the sandbox, installing proxies for globals etc.
     */
    public initialise(
        declaration: SandboxDeclaration,
        sandbox: Sandbox,
    ): Promise<void> {
        const mainWindow = this.mainWindow;
        const contentWindow = sandbox.getContentWindow();
        const contentDocument = sandbox.getContentDocument();

        const writableSandboxWindow = contentWindow as unknown as GlobalObject;
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

        // Main window should not (easily) be accessible - redirect to the sandbox window.
        proxyMap.set(mainWindow, sandboxWindowProxy);
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
                sandboxWindowProxy, // Redirect `.parent` back to the sandbox window.
                sandboxWindowProxy,
                sandboxWindowProxy, // Redirect `.top` back to the sandbox window.
                sandboxWindowProxy,
            );
        };

        writableSandboxWindow.quarantiner = {
            getSandbox: this.getSandbox,
            quarantine: sandboxContextEntrypoint as GlobalFunction,
        };

        /*
         * Wait for all sandboxee scripts executed so far to either succeed or fail,
         * resolving the promise regardless once all have executed.
         *
         * Note that it is possible for further scripts to execute and call .quarantine(...)
         * after this point, in which case it is necessary to:
         *
         * `await quarantiner.getSandbox(...).getPendingSandboxeePromise()`.
         */
        return new Promise((resolve) => {
            const sandboxeeSpecs = declaration.getSandboxeeSpecs();
            let pending = sandboxeeSpecs.length;

            for (const sandboxeeSpec of sandboxeeSpecs) {
                const script = contentDocument.createElement('script');

                script.addEventListener('load', () => {
                    sandboxeeSpec.onload();

                    pending--;

                    if (pending === 0) {
                        resolve();
                    }
                });

                script.addEventListener('error', (event) => {
                    sandboxeeSpec.onerror(event.error);

                    pending--;

                    if (pending === 0) {
                        resolve();
                    }
                });

                script.src = sandboxeeSpec.src;

                contentDocument.body.appendChild(script);
            }
        });
    }
}
