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

describe('DOM instanceof handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should support proxied DOM objects being instanceof sandbox global classes', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const div = window.document.createElement('div');
            
            window.myResult = {
                'instanceof HTMLDivElement': div instanceof window.HTMLDivElement,
                'instanceof HTMLSpanElement': div instanceof window.HTMLSpanElement
            };
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.deep.equal({
            'instanceof HTMLDivElement': true,
            'instanceof HTMLSpanElement': false,
        });
    });
});
