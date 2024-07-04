/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { loadScript } from 'buildbelt';

describe('Quarantiner library initialisation', () => {
    beforeEach(async () => {
        // Load Quarantiner library itself in the test runner document.
        await loadScript('/dist/quarantiner.umd.js');
    });

    it('should define the .quarantiner.quarantine(...) method', async () => {
        expect(
            (window as typeof window & GlobalObjectWithUmdGlobal).quarantiner
                .quarantine,
        ).to.be.a('function');
    });
});
