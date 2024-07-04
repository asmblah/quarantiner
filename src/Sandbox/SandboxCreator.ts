/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import Sandbox from './Sandbox';
import SandboxDeclaration from './SandboxDeclaration';

export default class SandboxCreator {
    /**
     * Creates a new <iframe>-based sandbox to execute JavaScript in,
     * separate from the main browsing context.
     */
    public async create(declaration: SandboxDeclaration): Promise<Sandbox> {
        return new Promise<Sandbox>((resolve) => {
            const onReady = () => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';

                iframe.addEventListener('load', () => {
                    resolve(new Sandbox(iframe, declaration.getName()));
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
