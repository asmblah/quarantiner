/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

export default {
    'plugins': ['@babel/plugin-transform-runtime'],
    'presets': [
        [
            '@babel/preset-env',
            {
                'modules': false,
                'useBuiltIns': 'usage',
                'corejs': 3,
            },
        ],
    ],
};
