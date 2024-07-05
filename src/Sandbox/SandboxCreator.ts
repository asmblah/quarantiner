/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox';

export default class SandboxCreator {
    /**
     * Creates a new <iframe>-based sandbox to execute JavaScript in,
     * separate from the main browsing context.
     */
    public async create(name: string): Promise<Sandbox> {
        return new Promise<Sandbox>((resolve) => {
            const onReady = () => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';

                iframe.addEventListener('load', () => {
                    resolve(new Sandbox(iframe, name));
                });

                document.body.appendChild(iframe);
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    onReady();
                });
            } else {
                // DOM is already ready.
                onReady();
            }
        });
    }
}
