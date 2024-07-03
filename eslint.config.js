/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
module.exports = require('buildbelt/eslint.config').map((config) =>
    Object.assign(config, {
        files: [
            '{src,test}/**/*.{js,jsx,mjs,mts,ts,tsx}',
            '*.{js,jsx,mjs,mts,ts,tsx}',
        ],
    }),
);
