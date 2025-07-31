import { io, Socket } from "socket.io-client";

export interface HandlerError {
  code: string;
  message: string;
}

export type CallbackData<Data> =
  | { data: Data; errors: undefined }
  | { data: undefined; errors: HandlerError[] };

interface CustomSocket extends Socket {
  customEmit(
    event: string,
    data: any,
    callback?: (result: CallbackData<any>) => void
  ): void;

  customEmit(
    event: string,
    callback?: (result: CallbackData<any>) => void
  ): void;
}

let socket: CustomSocket | undefined = undefined;

function enhanceSocket(_socket: Socket): CustomSocket {
  function customEmit(
    event: string,
    data: any,
    callback?: (result: CallbackData<any>) => void
  ): void;

  function customEmit(
    event: string,
    callback?: (result: CallbackData<any>) => void
  ): void;

  function customEmit(
    event: string,
    dataOrCallback: any | ((result: CallbackData<any>) => void),
    maybeCallback?: (result: CallbackData<any>) => void
  ) {
    let data: any;
    let callback: ((result: CallbackData<any>) => void) | undefined;

    // HACK: maybe thats idea is bullshit...
    // NOTE: socket.customEmit("someEvent", () => {})
    if (typeof dataOrCallback === "function") {
      (callback = dataOrCallback), (data = undefined);
    } else {
      // NOTE: socket.customEmit("someEvent", {someData: "data"}, () => {})
      data = dataOrCallback;
      callback = maybeCallback ?? (() => {});
    }

    _socket.emit(event, data, callback);
  }

  (_socket as CustomSocket).customEmit = customEmit;

  return _socket as CustomSocket;
}

export function useSocket(): CustomSocket {
  if (!socket) {
    const config = useRuntimeConfig();
    socket = enhanceSocket(
      io(config.public.backendUrl, { withCredentials: true })
    );
  }
  return enhanceSocket(socket);
}
