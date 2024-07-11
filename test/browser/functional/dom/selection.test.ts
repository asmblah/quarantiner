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

describe('DOM Selection handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should correctly proxy the Selection returned for document.getSelection()', async () => {
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
            
            // Access the sandbox window via the Node provided by the Selection to check proxying behaviour,
            // and also test the selection behaviour itself by extracting the selected text.
            selection.anchorNode.ownerDocument.defaultView.myValue = selection.toString();
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myValue).to.be.undefined;
        expect(sandbox.getGlobal('myValue')).to.equal('Hello world!');
    });

    it('should correctly proxy the Selection returned for window.getSelection()', async () => {
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
            
            const selection = window.getSelection();
            
            selection.selectAllChildren(parentDiv);
            
            // Access the sandbox window via the Node provided by the Selection to check proxying behaviour,
            // and also test the selection behaviour itself by extracting the selected text.
            selection.anchorNode.ownerDocument.defaultView.myValue = selection.toString();
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myValue).to.be.undefined;
        expect(sandbox.getGlobal('myValue')).to.equal('Hello world!');
    });
});
