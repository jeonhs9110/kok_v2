// Next.js requires this file to be named exactly `middleware.ts` (or .js)
// to register edge middleware. The actual logic lives in ./proxy so the
// pre-rename commit history stays readable; this file just re-exports it
// under the names Next.js expects.
export { proxy as middleware, config } from './proxy';
