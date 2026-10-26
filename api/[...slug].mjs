// Every /api/* request is handled by one shared handler (the same code the tests and local dev server use).
import handler from '../server/api.mjs';
const run=request=>handler(request);
export const GET=run,POST=run,PUT=run,PATCH=run,DELETE=run,HEAD=run,OPTIONS=run;
