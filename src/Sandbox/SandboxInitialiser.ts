/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox';

const BOMDOM = Symbol('BOM/DOM');
const FunctionToString = Function.prototype.toString;

type CallableFunction = ((...args: unknown[]) => unknown) & WritableObject;
type WritableDocument = Document & WritableObject;
type WritableWindow = Window & typeof globalThis & WritableObject;

export default class SandboxInitialiser {
    public constructor(
        private readonly mainWindow: Window & typeof globalThis,
        private readonly getSandbox: SandboxGetter,
    ) {}

    /**
     * Sets up the sandbox, installing proxies for globals etc.
     */
    public initialise(sandbox: Sandbox): void {
        const mainWindow = this.mainWindow;

        const HtmlAllCollection = mainWindow.HTMLAllCollection;

        const contentWindow = sandbox.getContentWindow();

        const writableSandboxWindow = contentWindow as unknown as GlobalObject;
        const sandboxWindow = contentWindow as Window & typeof globalThis;

        // A map from Proxies to the original object, such as the Document.
        const reverseProxyMap = new WeakMap();

        // A map from original objects, such as the Document, to its Proxy.
        const proxyMap = new WeakMap();

        const storeProxy = (
            originalValue: unknown,
            proxy: unknown,
        ): unknown => {
            proxyMap.set(originalValue as WeakKey, proxy);
            reverseProxyMap.set(proxy as WeakKey, originalValue);

            return proxy;
        };

        const isNativeFunction = (value: unknown): value is CallableFunction =>
            typeof value === 'function' &&
            /^function\s+[\w_]+\(\)\s*\{\s*\[native code]/.test(
                FunctionToString.call(value),
            );

        const createProxyIfNeeded = (value: unknown): unknown => {
            // Instead of a long list, check for a Symbol added to each prototype for speed.
            if ((value as WritableObject)[BOMDOM] === true) {
                return createBomOrDomObjectProxy(
                    value as typeof value & WritableObject,
                );
            }

            // Handle native BOM/DOM methods, e.g. .appendChild(...).
            if (isNativeFunction(value)) {
                return createBomOrDomObjectProxy(value);
            }

            return value;
        };

        const proxyProperty = (target: object, property: string | symbol) => {
            const value = (target as { [name: string]: unknown })[
                property as string
            ];

            return proxyValue(value);
        };

        const proxyValue = (value: unknown): unknown => {
            const valueType = typeof value;

            if (
                value === null ||
                (valueType !== 'object' &&
                    valueType !== 'function' &&
                    // `document.all`'s type is "undefined" for historical reasons.
                    !(value instanceof HtmlAllCollection))
            ) {
                // Scalar values require no special handling.
                return value;
            }

            if (proxyMap.has(value as WeakKey)) {
                return proxyMap.get(value as WeakKey);
            }

            return createProxyIfNeeded(value);
        };

        const createBomOrDomObjectProxy = <T extends WritableObject>(
            bomOrDomObject: T,
        ) => {
            return storeProxy(
                bomOrDomObject,
                new Proxy(bomOrDomObject, {
                    apply(
                        _target: unknown,
                        thisArg: unknown,
                        args: unknown[],
                    ): unknown {
                        // Map `this` back to its original if applicable (see below).
                        const unmappedThisObject = (
                            reverseProxyMap.has(thisArg as WeakKey)
                                ? reverseProxyMap.get(thisArg as WeakKey)
                                : thisArg
                        ) as object;

                        /*
                         * Map proxied values back to their originals.
                         * For example, only the native un-Proxy-wrapped DOM element
                         * must be passed into `.appendChild(...)`.
                         */
                        const unmappedArgs = args.map((arg) =>
                            reverseProxyMap.has(arg as WeakKey)
                                ? reverseProxyMap.get(arg as WeakKey)
                                : arg,
                        );

                        return proxyValue(
                            (
                                bomOrDomObject as unknown as CallableFunction
                            ).apply(unmappedThisObject, unmappedArgs),
                        );
                    },

                    construct(target: T, argArray: unknown[]): object {
                        return proxyValue(
                            Reflect.construct(
                                target as unknown as new (
                                    ...args: unknown[]
                                ) => unknown,
                                argArray,
                            ),
                        ) as object;
                    },

                    get(target: T, property: string | symbol): unknown {
                        return proxyProperty(target, property);
                    },

                    set(
                        target: T,
                        property: string,
                        newValue: unknown,
                    ): boolean {
                        /*
                         * Set properties directly on the BOM(Web API)/DOM object,
                         * as allowing them to be set via the default proxy trap results in e.g.:
                         *
                         * `Uncaught TypeError: 'set event' called on an object that does not implement interface Window.`.
                         */
                        (target as WritableObject)[property] = newValue;

                        return true;
                    },
                }),
            );
        };

        const sandboxWindowProxy = createBomOrDomObjectProxy(
            sandboxWindow as typeof window & WritableObject,
        ) as WritableWindow;

        const mainDocumentProxy = createBomOrDomObjectProxy(
            mainWindow.document as Document & WritableObject,
        ) as WritableDocument;
        // It should not (easily) be possible to access the sandbox document.

        // Main window should not (easily) be accessible - redirect to the sandbox window.
        proxyMap.set(mainWindow, sandboxWindowProxy);
        proxyMap.set(mainWindow.Array, sandboxWindow.Array);
        proxyMap.set(mainWindow.Boolean, sandboxWindow.Boolean);
        proxyMap.set(mainWindow.Number, sandboxWindow.Number);
        proxyMap.set(mainWindow.Object, sandboxWindow.Object);
        proxyMap.set(mainWindow.String, sandboxWindow.String);

        // Sandbox document should not (easily) be accessible - redirect to the main document's.
        proxyMap.set(sandboxWindow.document, mainDocumentProxy);

        const hookBom = () => {
            for (const bomClassName of ['MutationObserver']) {
                const bomClass = (sandboxWindow as WritableWindow)[
                    bomClassName
                ] as CallableFunction;

                // TODO: Consider never overriding built-ins in this way (which may be blocked
                //       due to property being non-configurable etc., instead return from globalThis/Window Proxy trap.
                (sandboxWindow as WritableWindow)[bomClassName] =
                    createBomOrDomObjectProxy(bomClass);

                bomClass.prototype[BOMDOM] = true;
            }
        };

        const hookDom = () => {
            // Instead of a long list, add a Symbol to each prototype to check for, for speed.
            for (const DomClass of [
                HtmlAllCollection,
                mainWindow.HTMLCollection,
                mainWindow.HTMLFormControlsCollection,
                mainWindow.Node,
                mainWindow.NodeList,
            ]) {
                (
                    DomClass.prototype as typeof DomClass.prototype &
                        WritableObject
                )[BOMDOM] = true;
            }
        };

        const hookStandard = () => {
            const NativeProxy = sandboxWindow.Proxy;

            class SandboxedProxy<T extends object> {
                public constructor(target: T, handler: ProxyHandler<T>) {
                    const getTrap = handler.get ?? null;

                    const modifiedHandler = getTrap
                        ? {
                              ...handler,

                              /**
                               * Override the get trap with one that will always handle our special BOMDOM symbol.
                               */
                              get(
                                  target: T,
                                  property: string | symbol,
                                  receiver: unknown,
                              ): unknown {
                                  if (property === BOMDOM) {
                                      // Don't allow a custom Proxy to handle fetches
                                      // of the special BOMDOM symbol property.
                                      return (target as WritableObject)[
                                          property
                                      ];
                                  }

                                  return (getTrap as CallableFunction).call(
                                      this,
                                      target,
                                      property,
                                      receiver,
                                  );
                              },
                          }
                        : handler;

                    // See https://stackoverflow.com/a/40714458/691504.
                    return new NativeProxy(
                        target,
                        Object.assign({}, modifiedHandler),
                    );
                }
            }

            // TODO: Not modify globalThis, see above.
            (sandboxWindow as WritableWindow).Proxy =
                SandboxedProxy as ProxyConstructor;
        };

        hookStandard();
        hookBom();
        hookDom();

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

        // Define the Quarantiner API on the sandbox window/global object,
        // for when the script re-executes inside the sandbox.
        writableSandboxWindow.quarantiner = {
            getSandbox: this.getSandbox,
            quarantine: sandboxContextEntrypoint as GlobalFunction,
        };
    }
}
