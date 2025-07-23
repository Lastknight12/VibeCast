import type { UseFetchOptions } from "#app";

export const useCustomFetch = (path: string, opts: UseFetchOptions<any>) => {
  return useFetch(path, {
    credentials: "include",
    baseURL: opts.baseURL ?? useRuntimeConfig().public.backendUrl,
    headers: opts.headers ?? useRequestHeaders(),
    ...opts,
  });
};
