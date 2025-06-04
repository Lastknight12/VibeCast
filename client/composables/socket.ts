import { io } from "socket.io-client";

let socket: ReturnType<typeof io> | null = null;

export function useSocket() {
  if (!socket) {
    const config = useRuntimeConfig();
    socket = io(config.public.backendUrl, { withCredentials: true });
  }
  return socket;
}
