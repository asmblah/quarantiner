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

        // Instead of a long list, add a Symbol to each prototype to check for, for speed.
        for (const BomOrDomClass of [
            mainWindow.HTMLAllCollection,
            mainWindow.HTMLCollection,
            mainWindow.HTMLFormControlsCollection,
            mainWindow.Node,
            mainWindow.NodeList,
        ]) {
            (
                BomOrDomClass.prototype as typeof BomOrDomClass.prototype &
                    WritableObject
            )[BOMDOM] = true;
        }

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

        const isNativeFunction = (
            value: unknown,
        ): value is (...args: unknown[]) => unknown =>
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
                return storeProxy(
                    value,
                    new Proxy(value, {
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
                                value.apply(unmappedThisObject, unmappedArgs),
                            );
                        },
                    }),
                );
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
