import { io, Socket } from "socket.io-client";
import { user } from "~/lib/randomUser";

export interface HandlerError {
  code: string;
  message: string;
}

export type SocketCallbackArgs<Res> =
  | { data: Res; errors?: undefined }
  | { data?: undefined; errors: HandlerError[] };

export type SocketCallback<Res> = (
  res: SocketCallbackArgs<Res>
) => void | Promise<void>;

let socket: Socket | undefined = undefined;

export function useSocket() {
  if (!socket) {
    const config = useRuntimeConfig();
    socket = io(config.public.backendUrl, {
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
      reconnection: true,
      auth: {
        userok: JSON.stringify(user),
      },
    });
  }

  if (!socket.connected) socket.connect();

  return socket;
}
