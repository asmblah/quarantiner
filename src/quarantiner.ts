/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox/Sandbox';
import SandboxRepository from './Sandbox/SandboxRepository';
import SandboxCreator from './Sandbox/SandboxCreator';
import SandboxInitialiser from './Sandbox/SandboxInitialiser';

const mainWindow = window;

const sandboxGetter = (name: string = 'default'): Promise<Sandbox> =>
    sandboxRepository.getSandbox(name);

const sandboxRepository = new SandboxRepository(
    new SandboxCreator(),
    new SandboxInitialiser(mainWindow, sandboxGetter),
);

const mainContextEntrypoint: Entrypoint = async (
    _wrapper: WrapperFunction,
    config: ConfigOptions = { globals: {}, sandbox: 'default' },
): Promise<void> => {
    const currentScript = document.currentScript ?? null;

    if (currentScript === null) {
        throw new Error('Quarantiner :: No current script');
    }

    if (currentScript.nodeName !== 'SCRIPT') {
        throw new Error('Quarantiner :: Not called from a script');
    }

    const sandboxName = config.sandbox;

    const sandboxDeclaration = sandboxRepository.declareSandbox(sandboxName);
    let sandbox: Sandbox | null = null;

    sandboxRepository.getSandbox(sandboxName).then((initialisedSandbox) => {
        sandbox = initialisedSandbox;

        sandbox.addPendingSandboxee(pendingSandboxeePromise);
    });

    // Capture the src of the script, as we will need to load it again inside the sandbox iframe.
    const currentScriptSrc = (currentScript as HTMLScriptElement).src;

    let loaded = false;
    const queuesByGlobalName: { [globalName: string]: CallQueue } = {};

    for (const globalName of Object.keys(config.globals)) {
        // Queue of calls to the global function before it is defined
        // by the code when run inside the sandbox, to be replayed when defined.
        const queue: CallQueue = [];

        queuesByGlobalName[globalName] = queue;

        if (config.globals[globalName].type !== 'function') {
            throw new Error('Quarantiner :: Only functions supported for now');
        }

        Object.defineProperty(mainWindow, globalName, {
            get() {
                return async (...args: unknown[]) => {
                    if (loaded) {
                        const globalValue = (sandbox as Sandbox).getGlobal(
                            globalName,
                        ) as GlobalFunction;

                        return globalValue(...args);
                    }

                    return new Promise((resolve, reject) => {
                        queue.push({
                            args,
                            resolve,
                            reject,
                        });
                    });
                };
            },

            set() {
                throw new Error(
                    `Quarantiner :: An attempt was made to overwrite proxied global ${globalName}`,
                );
            },
        });
    }

    const pendingSandboxeePromise = new Promise<void>((resolve, reject) => {
        sandboxDeclaration.addSandboxeeSpec({
            src: currentScriptSrc,

            onerror(error: unknown) {
                // Script failed to load inside the sandbox iframe.
                reject(error);
            },

            onload() {
                // Script loaded inside the sandbox iframe successfully.
                loaded = true;
                resolve();

                // Replay any calls that happened against this global during load now that the sandbox has loaded.
                for (const globalName of Object.keys(config.globals)) {
                    const queue = queuesByGlobalName[globalName];
                    const globalValue = (sandbox as Sandbox).getGlobal(
                        globalName,
                    ) as GlobalFunction;

                    for (const { args, resolve, reject } of queue) {
                        try {
                            resolve(globalValue(...args));
                        } catch (error) {
                            reject(error);
                        }
                    }

                    queue.length = 0;
                }
            },
        });
    });

    await pendingSandboxeePromise;
};

export const getSandbox = sandboxGetter;

export const quarantine = mainContextEntrypoint;
