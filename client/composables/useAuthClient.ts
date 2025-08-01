import { createAuthClient } from "better-auth/vue";

export default function useAuthClient() {
  const config = useRuntimeConfig();

  return createAuthClient({
    baseURL: config.public.backendUrl,
  });
}
