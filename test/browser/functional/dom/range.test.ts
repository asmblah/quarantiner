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

describe('DOM Range handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should correctly proxy the Ranges fetched from a Selection', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const parentDiv = window.document.createElement('div');
            window.document.body.appendChild(parentDiv);
            
            const childSpan1 = window.document.createElement('span');
            childSpan1.textContent = 'Hello ';
            parentDiv.appendChild(childSpan1);
            
            const childSpan2 = window.document.createElement('span');
            childSpan2.textContent = 'world!';
            parentDiv.appendChild(childSpan2);
            
            const selection = window.document.getSelection();
            
            selection.selectAllChildren(parentDiv);
            
            const range = selection.getRangeAt(0);
            
            // Access the sandbox window via the Node provided by the Range to check proxying behaviour,
            // and also test the selection behaviour itself by extracting the selected text.
            range.startContainer.ownerDocument.defaultView.myValue = range.toString();
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myValue).to.be.undefined;
        expect(sandbox.getGlobal('myValue')).to.equal('Hello world!');
    });
});
