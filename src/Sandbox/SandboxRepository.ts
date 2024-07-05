/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox';
import SandboxCreator from './SandboxCreator';
import SandboxInitialiser from './SandboxInitialiser';

export default class SandboxRepository {
    private readonly sandboxPromises: Record<string, Promise<Sandbox>> = {};

    public constructor(
        private readonly sandboxCreator: SandboxCreator,
        private readonly sandboxInitialiser: SandboxInitialiser,
    ) {}

    /**
     * Declares a sandbox.
     */
    public declareSandbox(name: string): Promise<Sandbox> {
        let sandboxPromise = this.sandboxPromises[name] ?? null;

        if (sandboxPromise) {
            return sandboxPromise; // Already declared.
        }

        sandboxPromise = this.sandboxCreator.create(name);

        // Ensure the stored Promise will only resolve after initialisation also completes.
        this.sandboxPromises[name] = sandboxPromise.then(async (sandbox) => {
            this.sandboxInitialiser.initialise(sandbox);

            return sandbox;
        });

        return sandboxPromise;
    }

    /**
     * Fetches a declared sandbox, resolving once it has completed initialisation.
     *
     * This will wait for all sandboxee scripts executed so far to either succeed or fail,
     * resolving the promise regardless once all have executed.
     *
     * Note that it is possible for further scripts to execute and call .quarantine(...)
     * after this point, in which case it is necessary to:
     *
     * `await quarantiner.getSandbox(...).getPendingSandboxeePromise()`.
     */
    public async getSandbox(name: string): Promise<Sandbox> {
        const sandboxPromise = this.sandboxPromises[name] ?? null;

        if (sandboxPromise === null) {
            throw new Error(
                `No sandbox with name "${name}" has been declared.`,
            );
        }

        // Await execution of any pending scripts up to this point.
        return (await sandboxPromise).getPendingSandboxeePromise();
    }

    /**
     * Adds a script to be executed inside a sandbox that may or may not have initialised yet.
     */
    public async sandboxScript(
        name: string,
        scriptSrc: string,
    ): Promise<Sandbox> {
        const sandbox = await this.declareSandbox(name);

        const scriptExecutionPromise = sandbox.loadScript(scriptSrc);

        // Wait for the script to execute before resolving this .sandboxScript(...) promise.
        await scriptExecutionPromise;

        return sandbox;
    }
}
