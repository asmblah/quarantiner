/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { loadJsAsScript, loadScript } from 'buildbelt';

describe('BOM MutationObserver handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should support MutationObservers', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const log = [];
            
            const observer = new window.MutationObserver((mutationList, observer) => {
                for (const mutation of mutationList) {
                    if (mutation.type === 'childList') {
                        log.push('A child node was added or removed.');
                    } else if (mutation.type === 'attributes') {
                        log.push(\`The \${mutation.attributeName} attribute was modified.\`);
                    }
                }
            });
            
            const body = window.document.body;
            
            observer.observe(body, { attributes: true, childList: true, subtree: true });
            
            // Set an attribute (first modification).
            body.setAttribute('data-my-attr', 'hello');
            
            // Add a child element (second modification).
            body.appendChild(window.document.createElement('div'));
            
            window.log = log;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.log).to.be.undefined;
        expect(sandbox.getGlobal('log')).to.deep.equal([
            'The data-my-attr attribute was modified.',
            'A child node was added or removed.',
        ]);
    });
});
