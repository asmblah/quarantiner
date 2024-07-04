/*
 * Quarantiner - A script isolator.
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/asmblah/quarantiner/
 *
 * Released under the MIT license
 * https://github.com/asmblah/quarantiner/raw/main/MIT-LICENSE.txt
 */

/*
 * Tools/helpers for testing.
 */

/**
 * Loads a script file given its src inside the test document
 * and returns a Promise resolved on its load (or rejected on failure).
 */
export const loadScript = (src: string): Promise<HTMLScriptElement> => {
    const script: HTMLScriptElement = document.createElement('script');

    return new Promise<HTMLScriptElement>((resolve, reject) => {
        script.addEventListener('load', () => {
            resolve(script);
        });
        script.addEventListener('error', (event) => {
            reject(event.error ?? new Error(`Script "${src}" failed to load`));
        });

        script.src = src;

        document.body.appendChild(script);
    });
};

/**
 * Loads a script given its raw JS inside the test document
 * and returns a Promise resolved on its load (or rejected on failure).
 */
export const loadJsAsScript = (js: string): Promise<HTMLScriptElement> =>
    loadScript('data:application/javascript;base64,' + btoa(js));
