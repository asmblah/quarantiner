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

describe('Document DOM element handling', () => {
    let quarantiner: UmdGlobal;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it("should use the main window's document", async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var div = window.document.createElement('div');
            div.id = 'myDiv';
            div.textContent = 'Hello!';
            
            window.document.body.appendChild(div);
        });
        `);
        await quarantiner.getSandbox(); // Wait for the script above to be re-executed inside the sandbox.
        const div = document.getElementById('myDiv');

        expect(div).to.be.an.instanceOf(HTMLDivElement);
        expect(div?.textContent).to.equal('Hello!');
    });
});
