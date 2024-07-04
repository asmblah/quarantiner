/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

export default class Sandbox {
    private readonly globalObject: WritableGlobalObject;
    private pendingSandboxeesPromise: Promise<void>;

    public constructor(
        private readonly iframe: HTMLIFrameElement,
        private readonly name: string,
    ) {
        this.globalObject = iframe.contentWindow as typeof window &
            WritableGlobalObject;

        this.pendingSandboxeesPromise = Promise.resolve();
    }

    /**
     * Adds a promise for a pending sandboxee script,
     * allowing external code to await any pending loads at a given point.
     */
    public addPendingSandboxee(promise: Promise<void>): void {
        this.pendingSandboxeesPromise = this.pendingSandboxeesPromise.then(
            () => promise,
        );
    }

    /**
     * Fetches the inner document of the sandbox <iframe>.
     */
    public getContentDocument(): Document {
        return this.iframe.contentDocument as Document;
    }

    /**
     * Fetches the inner window of the sandbox <iframe>.
     */
    public getContentWindow(): Window {
        return this.iframe.contentWindow as Window;
    }

    /**
     * Fetches the value of a global from inside the sandbox.
     */
    public getGlobal(name: string): unknown {
        return this.globalObject[name];
    }

    /**
     * Fetches the sandbox <iframe> DOM element.
     */
    public getIframe(): HTMLIFrameElement {
        return this.iframe;
    }

    /**
     * Fetches the unique name of the sandbox.
     */
    public getName(): string {
        return this.name;
    }

    /**
     * Fetches the promise for all currently pending sandboxee scripts,
     * allowing external code to await any pending loads at a given point.
     */
    public getPendingSandboxeePromise(): Promise<void> {
        return this.pendingSandboxeesPromise;
    }
}
