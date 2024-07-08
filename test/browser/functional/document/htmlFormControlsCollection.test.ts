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

describe('Document DOM HTMLFormControlsCollection handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should return the sandbox window for htmlFormControlsCollection[N].ownerDocument.defaultView', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            var form = window.document.createElement('form');
            window.document.body.appendChild(form);
            
            var field = window.document.createElement('input');
            field.type = 'text';
            field.name = 'myField';
            form.appendChild(field);
            
            var htmlFormControlsCollection = form.elements;
            
            htmlFormControlsCollection[0].ownerDocument.defaultView.myValue = 101;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myValue).to.be.undefined;
        expect(sandbox.getGlobal('myValue')).to.equal(101);
    });
});
