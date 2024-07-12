/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox';

const BOM_OR_DOM = Symbol('BOM/DOM');
const FunctionToString = Function.prototype.toString;

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
        const writableMainWindow =
            mainWindow as unknown as WritableGlobalObject;

        const HtmlAllCollection = mainWindow.HTMLAllCollection;

        const contentWindow = sandbox.getContentWindow();

        const writableSandboxWindow =
            contentWindow as unknown as WritableGlobalObject;
        const sandboxWindow = contentWindow as Window & typeof globalThis;

        // Note that classes added here will not be proxied, so they are listed here for efficiency.
        const sandboxGlobals = new Map<string | symbol, unknown>([
            ['Array', sandboxWindow.Array],
            ['Map', sandboxWindow.Map],
            ['Object', sandboxWindow.Object],
            ['Set', sandboxWindow.Set],
            ['WeakMap', sandboxWindow.WeakMap],
            ['WeakSet', sandboxWindow.WeakSet],
        ]);

        // A map from Proxies to the original object, such as the Document.
        const reverseProxyMap = new WeakMap();

        // A map from original objects, such as the Document, to its Proxy.
        const proxyMap = new WeakMap();

        const mainWindowArrayPrototype = mainWindow.Array.prototype;
        const sandboxWindowArrayPrototype = sandboxWindow.Array.prototype;

        // We cannot rely on Array.isArray(...) alone, as that will return true
        // for Array.prototype itself too.
        const isArray = (value: unknown): value is unknown[] =>
            Array.isArray(value) &&
            value !== mainWindowArrayPrototype &&
            value !== sandboxWindowArrayPrototype;

        const storeProxy = (
            originalValue: unknown,
            proxy: unknown,
        ): unknown => {
            proxyMap.set(originalValue as WeakKey, proxy);
            reverseProxyMap.set(proxy as WeakKey, originalValue);

            return proxy;
        };

        const isNativeFunction = (
            value: unknown,
        ): value is WritableCallableFunction =>
            typeof value === 'function' &&
            /^function\s+[\w_]+\(\)\s*\{\s*\[native code]/.test(
                FunctionToString.call(value),
            );

        const createProxyIfNeeded = (value: unknown): unknown => {
            // Instead of a long list, check for a Symbol added to each prototype for speed.
            if ((value as WritableObject)[BOM_OR_DOM] === true) {
                return createObjectProxy(
                    value as typeof value & WritableObject,
                );
            }

            // Handle native BOM/DOM methods, e.g. .appendChild(...).
            if (isNativeFunction(value)) {
                return createObjectProxy(value);
            }

            if (isArray(value)) {
                /*
                 * Array elements will be proxied if needed on fetch, etc.
                 * We could map to a new array, but this way we save
                 * by not needing to iterate over all elements
                 * and modifications to the original array will affect the proxy.
                 */
                return createObjectProxy(
                    value as typeof value & WritableObject,
                );
            }

            // There is no need to proxy the value, for efficiency.
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

        /*
         * Maps proxied values back to their originals.
         * For example, only the native un-Proxy-wrapped DOM element
         * must be passed into `.appendChild(...)`.
         */
        const unproxyValue = (value: unknown): unknown => {
            if (reverseProxyMap.has(value as WeakKey)) {
                return reverseProxyMap.get(value as WeakKey);
            }

            if (typeof value === 'function') {
                /*
                 * Value is a function, e.g. the callback passed to .addEventListener(...).
                 * We need to map any applicable arguments, e.g. wrapping an Event with a Proxy<Event>.
                 *
                 * Use a Proxy so that Object.defineProperty(...) will define properties
                 * on the original function object, etc.
                 *
                 * TODO: Cache these proxy instances for efficiency.
                 */
                return new Proxy(value, {
                    apply(
                        target: WritableCallableFunction,
                        thisArg: unknown,
                        args: unknown[],
                    ) {
                        return target.apply(
                            thisArg,
                            args.map((arg) => proxyValue(arg)),
                        );
                    },
                });
            }

            if (isArray(value)) {
                return value.map((element) => unproxyValue(element));
            }

            return value;
        };

        const unproxyArgs = (args: unknown[]): unknown[] =>
            args.map((arg) => unproxyValue(arg));

        const unproxyThisObject = (thisArg: unknown): object =>
            reverseProxyMap.has(thisArg as WeakKey)
                ? reverseProxyMap.get(thisArg as WeakKey)
                : thisArg;

        const createInnerProxyTarget = (target: unknown): WritableObject => {
            if (typeof target === 'function') {
                // Proxy target must be a function for apply(...)/construct(...) traps to work.
                return (() => {}) as unknown as WritableObject;
            }

            if (Array.isArray(target)) {
                // Target must itself be an array for Array.isArray(...) to work.
                return [] as unknown as WritableObject;
            }

            return Object.create(null);
        };

        const createObjectProxy = <T extends WritableObject>(
            target: T,
            proxyObjectProperty = proxyProperty,
        ) => {
            /*
             * Use a different actual Proxy target than the real object,
             * to avoid various Proxy invariant issues
             * such as being unable to override non-configurable non-writable properties.
             */
            const innerTarget = createInnerProxyTarget(target);

            // Keep a reference to the original value for debugging.
            innerTarget.original = target;

            return storeProxy(
                target,
                new Proxy(innerTarget, {
                    apply(
                        _target: unknown,
                        thisArg: unknown,
                        args: unknown[],
                    ): unknown {
                        // Map `this` back to its original if applicable (see below).
                        const unproxiedThisObject = unproxyThisObject(thisArg);

                        const unproxiedArgs = unproxyArgs(args);

                        return proxyValue(
                            (
                                target as unknown as WritableCallableFunction
                            ).apply(unproxiedThisObject, unproxiedArgs),
                        );
                    },

                    construct(_target: T, args: unknown[]): object {
                        const unproxiedArgs = unproxyArgs(args);

                        return proxyValue(
                            Reflect.construct(
                                // NB: `target` here is the original constructor being proxied.
                                target as unknown as new (
                                    ...args: unknown[]
                                ) => unknown,
                                unproxiedArgs,
                            ),
                        ) as object;
                    },

                    defineProperty(
                        _target: T,
                        property: string | symbol,
                        attributes: PropertyDescriptor,
                    ): boolean {
                        Reflect.defineProperty(target, property, attributes);

                        return true;
                    },

                    deleteProperty(
                        _target: T,
                        property: string | symbol,
                    ): boolean {
                        return Reflect.deleteProperty(target, property);
                    },

                    get(_target: T, property: string | symbol): unknown {
                        return proxyObjectProperty(target, property);
                    },

                    getOwnPropertyDescriptor(
                        _target: T,
                        property: string | symbol,
                    ): PropertyDescriptor | undefined {
                        return Reflect.getOwnPropertyDescriptor(
                            target,
                            property,
                        );
                    },

                    getPrototypeOf(): object | null {
                        const constructorName =
                            target.constructor?.name ?? null;

                        // TODO: Cache prototype for efficiency (see below).

                        if (constructorName !== null) {
                            // We have a constructor name - look up the constructor within
                            // the sandbox window realm, so we can create a prototype extending its own.
                            const sandboxRealmConstructor: WritableCallableFunction | null =
                                ((sandboxWindow as WritableWindow)[
                                    constructorName
                                ] as WritableCallableFunction) ?? null;

                            if (sandboxRealmConstructor !== null) {
                                // TODO: Cache this prototype object in a WeakMap for efficiency.
                                return Object.create(
                                    sandboxRealmConstructor.prototype,
                                );
                            }
                        }

                        // We do not have a constructor property to look up.
                        return Reflect.getPrototypeOf(target);
                    },

                    has(_target: T, property: string | symbol): boolean {
                        return Reflect.has(target, property);
                    },

                    isExtensible(): boolean {
                        return Reflect.isExtensible(target);
                    },

                    ownKeys(): ArrayLike<string | symbol> {
                        return Reflect.ownKeys(target);
                    },

                    preventExtensions(): boolean {
                        return Reflect.preventExtensions(target);
                    },

                    set(
                        _target: T,
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

                    setPrototypeOf(
                        _target: T,
                        newPrototype: object | null,
                    ): boolean {
                        return Reflect.setPrototypeOf(target, newPrototype);
                    },
                }),
            );
        };

        const isScalar = (value: unknown): boolean => {
            const type = typeof value;

            return type === 'number' || type === 'string' || type === 'boolean';
        };

        const sandboxWindowProxy = createObjectProxy(
            sandboxWindow as typeof window & WritableObject,
            (target, property) => {
                if (property === 'undefined') {
                    // TODO: Define common globals during compilation to avoid lookups.
                    return undefined;
                }

                // TODO: Return early if `property === Symbol.unscopables` for speed?

                // Properties to just fetch unchanged from the main window.
                if (['visualViewport'].includes(property as string)) {
                    return writableMainWindow[property as string];
                }

                // Overrides for specific global/window properties.
                if (sandboxGlobals.has(property)) {
                    return sandboxGlobals.get(property);
                }

                const sandboxWindowValue = proxyProperty(target, property);

                if (isScalar(sandboxWindowValue)) {
                    const mainWindowValue =
                        writableMainWindow[property as string];

                    if (isScalar(mainWindowValue)) {
                        // Fetch scalar values from the main window.
                        return mainWindowValue;
                    }
                }

                return sandboxWindowValue;
            },
        ) as WritableWindow;

        const mainDocumentProxy = createObjectProxy(
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

        const hookEventListenerHandling = () => {
            const nativeAddEventListener =
                mainWindow.EventTarget.prototype.addEventListener;
            const nativeRemoveEventListener =
                mainWindow.EventTarget.prototype.removeEventListener;

            const eventListenerMap = new WeakMap();

            proxyMap.set(
                nativeAddEventListener,
                function addEventListener(
                    this: EventTarget,
                    type: string,
                    callback: EventListenerOrEventListenerObject | null,
                    options?: EventListenerOptions | boolean,
                ): void {
                    // Map proxied DOM object back to its original.
                    const unproxiedDomObject = unproxyThisObject(this);

                    let eventListener: EventListener | null = null;

                    if (typeof callback === 'function') {
                        eventListener = (event: Event) => {
                            // Map the Event with a Proxy<Event> so that `.target` etc. are proxied.
                            callback.call(this, proxyValue(event) as Event);
                        };
                    } else if (
                        callback !== null &&
                        typeof callback === 'object'
                    ) {
                        throw new Error(
                            'EventListenerObjects not yet supported',
                        );
                    }

                    eventListenerMap.set(callback as WeakKey, eventListener);

                    nativeAddEventListener.call(
                        unproxiedDomObject,
                        type,
                        eventListener,
                        options,
                    );
                },
            );

            proxyMap.set(
                nativeRemoveEventListener,
                function removeEventListener(
                    this: EventTarget,
                    type: string,
                    callback: EventListenerOrEventListenerObject | null,
                    options?: EventListenerOptions | boolean,
                ): void {
                    // Map proxied DOM object back to its original.
                    const unproxiedDomObject = unproxyThisObject(this);

                    const eventListener = eventListenerMap.has(
                        callback as WeakKey,
                    )
                        ? eventListenerMap.get(callback as WeakKey)
                        : callback;

                    nativeRemoveEventListener.call(
                        unproxiedDomObject,
                        type,
                        eventListener,
                        options,
                    );
                },
            );
        };

        const markAsProxiable = (value: unknown) => {
            (value as WritableObject)[BOM_OR_DOM] = true;
        };

        const hookBom = () => {
            // TODO: Can this be done the same as for the DOM, without overriding anything (other options mentioned elsewhere)?
            //       Need to consider that MutationObserver is meant to be instantiated by the user.
            for (const bomClassName of ['MutationObserver', 'MutationRecord']) {
                const bomClass = writableSandboxWindow[
                    bomClassName
                ] as WritableCallableFunction;

                sandboxGlobals.set(bomClassName, createObjectProxy(bomClass));

                markAsProxiable(bomClass.prototype);
            }

            sandboxGlobals.set('focus', () => mainWindow.focus());
            sandboxGlobals.set(
                'getSelection',
                () => proxyValue(mainWindow.getSelection()) as Selection | null,
            );
        };

        const hookDom = () => {
            // Instead of a long list, add a Symbol to each prototype to check for, for speed.
            for (const DomClass of [
                HtmlAllCollection,
                mainWindow.Event, // TODO: Ensure both of these are covered by tests.
                sandboxWindow.Event,
                mainWindow.EventTarget,
                mainWindow.HTMLCollection,
                mainWindow.HTMLFormControlsCollection,
                mainWindow.Node,
                mainWindow.NodeList,
                mainWindow.Range,
                mainWindow.Selection,
            ]) {
                markAsProxiable(DomClass.prototype);
            }

            // CaretPosition is experimental, but supported in Firefox at time of writing.
            const CaretPosition =
                (
                    mainWindow as typeof mainWindow & {
                        CaretPosition: WritableCallableFunction;
                    }
                ).CaretPosition ?? null;

            if (CaretPosition !== null) {
                markAsProxiable(CaretPosition.prototype);
            }

            hookEventListenerHandling();
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
                               * Override the get trap with one that will always handle our special BOM_OR_DOM symbol.
                               */
                              get(
                                  target: T,
                                  property: string | symbol,
                                  receiver: unknown,
                              ): unknown {
                                  if (property === BOM_OR_DOM) {
                                      // Don't allow a custom Proxy to handle fetches
                                      // of the special BOM_OR_DOM symbol property.
                                      return (target as WritableObject)[
                                          property
                                      ];
                                  }

                                  return (
                                      getTrap as WritableCallableFunction
                                  ).call(target, target, property, receiver);
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

            sandboxGlobals.set('Proxy', SandboxedProxy as ProxyConstructor);
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
            quarantine: sandboxContextEntrypoint,
        };
    }
}
