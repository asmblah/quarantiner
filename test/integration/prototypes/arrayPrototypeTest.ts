/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

// import plugin from '../../../dist/plugin';
// import { rollup } from 'rollup';

describe.skip('Array.prototype isolation', () => {
    it('modifying Array.prototype should not affect the main window', async () => {
        // const bundle = await rollup({
        //     input: import.meta.resolve('./fixtures/arrayPrototypeEntry.ts'),
        //     plugins: [plugin()],
        // });
    });
});
