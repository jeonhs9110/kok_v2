export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise against a deadline. Rejects with TimeoutError on hit,
 * otherwise resolves/rejects with the underlying promise. Used to bound
 * Supabase queries inside server cache functions so a slow DB doesn't
 * burn the Vercel route's 10s budget.
 */
export function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    Promise.resolve(p).then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}
