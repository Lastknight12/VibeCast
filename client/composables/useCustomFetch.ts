import type { UseFetchOptions } from "#app";

export function useCustomFetch(path: string, opts: UseFetchOptions<any>) {
  return useFetch(path, {
    baseURL: opts.baseURL ?? useRuntimeConfig().public.backendUrl,
    headers: opts.headers ?? useRequestHeaders(),
    ...opts,
  });
}
