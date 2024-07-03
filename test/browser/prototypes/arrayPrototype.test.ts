/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { Entrypoint } from '../../../src/quarantiner';

describe('Array.prototype isolation', () => {
    it('modifying Array.prototype should not affect the main window', async () => {
        await import('../../../dist/quarantiner.umd.js');

        expect(
            typeof (window as typeof window & { quarantiner: Entrypoint })
                .quarantiner,
        ).to.equal('function');
    });
});
