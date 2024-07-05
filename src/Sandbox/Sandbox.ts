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
    private pendingSandboxeeSpecs: SandboxeeSpec[] = [];
    private pendingSandboxeesPromise: Promise<Sandbox>;

    public constructor(
        private readonly iframe: HTMLIFrameElement,
        private readonly name: string,
    ) {
        this.globalObject = iframe.contentWindow as typeof window &
            WritableGlobalObject;
        this.pendingSandboxeesPromise = Promise.resolve(this);
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
    public getPendingSandboxeePromise(): Promise<Sandbox> {
        return this.pendingSandboxeesPromise;
    }

    /**
     * Adds a script to be loaded inside the sandbox.
     */
    public async loadScript(scriptSrc: string): Promise<Sandbox> {
        const alreadyProcessing = this.pendingSandboxeeSpecs.length > 0;
        const contentDocument = this.getContentDocument();

        const promise = new Promise<Sandbox>((resolve, reject) => {
            this.pendingSandboxeeSpecs.push({
                src: scriptSrc,
                onload: () => {
                    resolve(this);
                },
                onerror: (error: unknown) => {
                    reject(error);
                },
            });
        });

        this.pendingSandboxeesPromise = this.pendingSandboxeesPromise.then(
            () => promise,
        );

        if (alreadyProcessing) {
            return promise;
        }

        const dequeue = () => {
            const sandboxeeSpec =
                this.pendingSandboxeeSpecs.shift() as SandboxeeSpec;

            const script = contentDocument.createElement('script');

            script.addEventListener('load', () => {
                sandboxeeSpec.onload();

                if (this.pendingSandboxeeSpecs.length > 0) {
                    dequeue();
                }
            });

            script.addEventListener('error', (event) => {
                sandboxeeSpec.onerror(event.error);

                if (this.pendingSandboxeeSpecs.length > 0) {
                    dequeue();
                }
            });

            script.src = sandboxeeSpec.src;

            contentDocument.body.appendChild(script);
        };

        dequeue();

        return promise;
    }
}
