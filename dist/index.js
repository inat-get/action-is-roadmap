import * as core from '@actions/core';

/**
 * Waits for a number of milliseconds.
 *
 * @param milliseconds The number of milliseconds to wait.
 * @returns Resolves with 'done!' after the wait is over.
 */
async function wait(milliseconds) {
    return new Promise((resolve) => {
        if (isNaN(milliseconds))
            throw new Error('milliseconds is not a number');
        setTimeout(() => resolve('done!'), milliseconds);
    });
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
async function run() {
    try {
        const ms = core.getInput('milliseconds');
        // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
        core.debug(`Waiting ${ms} milliseconds ...`);
        // Log the current timestamp, wait, then log the new timestamp
        core.debug(new Date().toTimeString());
        await wait(parseInt(ms, 10));
        core.debug(new Date().toTimeString());
        // Set outputs for other workflow steps to use
        core.setOutput('time', new Date().toTimeString());
    }
    catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}

/**
 * The entrypoint for the action. This file simply imports and runs the action's
 * main logic.
 */
/* istanbul ignore next */
run();
//# sourceMappingURL=index.js.map
