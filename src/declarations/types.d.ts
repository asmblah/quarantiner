/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

// Import() syntax must be used to keep this as an ambient context
// and prevent this module needing to export its types.
type Sandbox = import('../Sandbox/Sandbox').default;

type CallQueue = {
    args: unknown[];
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}[];

type ConfigOptions = {
    globals: {
        [name: string]: {
            type: 'function' | 'object';
        };
    };
    sandbox: string;
};

type GlobalFunction = (...args: unknown[]) => unknown;
type WritableGlobalObject = {
    [property: string]: GlobalFunction;
};

type GlobalObjectWithUmdGlobal = {
    quarantiner: UmdGlobal;
};

type GlobalObject = WritableGlobalObject | GlobalObjectWithUmdGlobal;

type WritableObject = {
    [property: string]: unknown;
};

type SandboxeeSpec = {
    src: string;
    onload: () => void;
    onerror: (error: unknown) => void;
};

type WrapperFunction = (
    parent: Window,
    self: Window,
    top: Window,
    window: Window,
) => void;

// Signature for the `globalThis.quarantiner(...)` entrypoint function.
type Entrypoint = (wrapper: WrapperFunction, config: ConfigOptions) => void;

type SandboxGetter = (name?: string) => Promise<Sandbox>;

// These need to match the named exports of the entrypoint quarantiner.ts.
type UmdGlobal = {
    getSandbox: SandboxGetter;
    quarantine: Entrypoint;
};
