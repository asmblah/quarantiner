/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

export default class SandboxDeclaration {
    private readonly sandboxeeSpecs: SandboxeeSpec[] = [];

    public constructor(private readonly name: string) {}

    /**
     * Adds a spec for a script that is to be run in the sandbox once loaded.
     */
    public addSandboxeeSpec(spec: SandboxeeSpec): void {
        this.sandboxeeSpecs.push(spec);
    }

    /**
     * Fetches the unique name of the sandbox.
     */
    public getName(): string {
        return this.name;
    }

    /**
     * Fetches all queued specs for scripts to be run in the sandbox once loaded.
     */
    public getSandboxeeSpecs(): SandboxeeSpec[] {
        return this.sandboxeeSpecs;
    }
}
