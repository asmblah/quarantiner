/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { loadJsAsScript, loadScript } from '../../../harness/tools';

describe('Document DOM element .ownerDocument handling', () => {
    let quarantiner: UmdGlobal;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it("should return the main window's document", async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div = window.document.createElement('div');
            window.document.body.appendChild(div);
            
            // Should be writing to the main window's document,
            // even though we are executing inside the sandbox.
            div.ownerDocument.myValue = 101;
        });
        `);
        const sandbox = await quarantiner.getSandbox();
        await sandbox.getPendingSandboxeePromise(); // Wait for the script above to be re-executed inside the sandbox.

        expect((document as unknown as WritableObject).myValue).to.equal(101);
        expect(
            (sandbox.getContentDocument() as unknown as WritableObject).myValue,
        ).to.be.undefined;
    });
});
