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
import SandboxDeclaration from './SandboxDeclaration';
import SandboxInitialiser from './SandboxInitialiser';

export default class SandboxRepository {
    private readonly sandboxDeclarations: Record<string, SandboxDeclaration> =
        {};
    private readonly sandboxInitialisationPromises: Record<
        string,
        Promise<Sandbox>
    > = {};

    public constructor(
        private readonly sandboxCreator: SandboxCreator,
        private readonly sandboxInitialiser: SandboxInitialiser,
    ) {}

    /**
     * Declares a sandbox.
     */
    public declareSandbox(name: string): SandboxDeclaration {
        let declaration = this.sandboxDeclarations[name] ?? null;

        if (declaration) {
            return declaration; // Already declared.
        }

        declaration = new SandboxDeclaration(name);
        this.sandboxDeclarations[name] = declaration;

        const sandboxLoadPromise = this.sandboxCreator.create(declaration);

        // Ensure the stored Promise will only resolve after initialisation also completes.
        this.sandboxInitialisationPromises[name] = sandboxLoadPromise.then(
            async (sandbox) => {
                await this.sandboxInitialiser.initialise(declaration, sandbox);

                return sandbox;
            },
        );

        return declaration;
    }

    /**
     * Fetches a declared sandbox, resolving once it has completed initialisation.
     */
    public getSandbox(name: string): Promise<Sandbox> {
        const sandboxInitialisationPromise =
            this.sandboxInitialisationPromises[name] ?? null;

        if (sandboxInitialisationPromise === null) {
            throw new Error(
                `No sandbox with name "${name}" has been declared.`,
            );
        }

        return sandboxInitialisationPromise;
    }
}
