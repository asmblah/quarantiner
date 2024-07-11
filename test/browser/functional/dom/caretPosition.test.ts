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

describe('DOM CaretPosition handling', () => {
    let quarantiner: UmdGlobal;
    let writableWindow: WritableGlobalObject;

    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');

        writableWindow = window as unknown as WritableGlobalObject;
        quarantiner = (window as typeof window & GlobalObjectWithUmdGlobal)
            .quarantiner;
    });

    it('should correctly proxy the CaretPosition fetched from document.caretPositionFromPoint(...)', async () => {
        await loadJsAsScript(`
        quarantiner.quarantine(function (parent, self, top, window) {
            const div = window.document.createElement('div');
            Object.assign(div.style, {
                height: '100px',
                left: 0,
                position: 'absolute',
                top: 0,
                width: '100px',
                zIndex: 1000,
            });
            div.textContent = 'Hello world!';
            window.document.body.appendChild(div);
            
            const caretPosition = window.document.caretPositionFromPoint(50, 50);
            
            // Access the sandbox window via the Node provided by the CaretPosition to check proxying behaviour,
            // and also test the selection behaviour itself by extracting the selected text.
            caretPosition.offsetNode.ownerDocument.defaultView.myResult = caretPosition.offsetNode.textContent;
        });
        `);
        // Wait for the script above to be re-executed inside the sandbox.
        const sandbox = await quarantiner.getSandbox();

        expect(writableWindow.myResult).to.be.undefined;
        expect(sandbox.getGlobal('myResult')).to.equal('Hello world!');
    });
});
