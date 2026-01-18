import { io, Socket } from "socket.io-client";

export interface HandlerError {
  code: string;
  message: string;
}

export type CallbackResult<Res> =
  | { data: Res; errors?: undefined }
  | { data?: undefined; errors: HandlerError[] };

let socket: Socket;

export function useSocket() {
  if (!socket) {
    const config = useRuntimeConfig();
    socket = io(config.public.backendUrl, {
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 5000,
    });
  }

  if (socket && !socket.connected) socket.connect();

  return socket;
}

export async function emitSocket<Data = unknown>(
  event: string,
  ...args: any[]
): Promise<{ data?: Data; errors?: HandlerError[] }> {
  const socket = useSocket();
  let errors: HandlerError[] | undefined = undefined;
  let data: Data | undefined = undefined;

  await new Promise<void>((resolve) => {
    const handler = (result: CallbackResult<Data>) => {
      errors = result.errors;

      data = result.data;
      resolve();
    };

    socket.emit(event, ...args, handler);
  });

  return {
    data,
    errors,
  };
}
