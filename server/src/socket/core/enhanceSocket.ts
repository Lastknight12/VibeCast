import { TSchema } from "@sinclair/typebox";
import { Socket } from "socket.io";
import { DefaultEventsMap, EventsMap } from "socket.io/dist/typed-events";
import { CustomSocket, SocketData } from "src/types/socket";
import { DefaultHandlerCb, EventError } from "src/socket/core";
import { ServerToClientEvents } from "src/types/socket";
import {
  TypeCheck,
  TypeCompiler,
  ValueErrorType,
} from "@sinclair/typebox/compiler";

export interface CustomOnConfig<ExpectCb extends boolean> {
  schema?: ReturnType<typeof TypeCompiler.Compile>;
  expectCb?: ExpectCb;
}

export interface CustomOnParams<ExpectCb extends boolean = false> {
  event: string;
  config?: CustomOnConfig<ExpectCb>;
  handler: ExpectCb extends true
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any, cb: DefaultHandlerCb) => void | Promise<void>
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data: any) => void | Promise<void>;
}
export type CustomOn = <ExpectCb extends boolean>(
  params: CustomOnParams<ExpectCb>
) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractPayloadAndCb(args: unknown[]): {
  payload?: object;
  cb?: DefaultHandlerCb;
} {
  const cb: DefaultHandlerCb | undefined =
    (args.findLast((elem) => typeof elem === "function") as DefaultHandlerCb) ??
    undefined;

  const payload = isPlainObject(args[0]) ? args[0] : undefined;

  return { payload, cb };
}

function isExpectCb(x: CustomOnParams<boolean>): x is CustomOnParams<true> {
  return x.config?.expectCb === true;
}

function enhanceSocket(
  _socket: Socket<EventsMap, ServerToClientEvents, DefaultEventsMap, SocketData>
): CustomSocket {
  // TODO: add emitWithAck support
  function customOn(
    params: CustomOnParams<true> | CustomOnParams<false>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = async (...args: any[]) => {
      if (params.config?.schema) {
        const userData = args[0];
        const validator = params.config.schema as TypeCheck<TSchema>;
        const isValid = validator.Check(userData);

        const formatedDetails: EventError["details"] = [];

        for (const error of validator.Errors(userData)) {
          formatedDetails.push({
            path: error.path,
            keyword: ValueErrorType[error.type],
            message: error.message,
          });
        }

        if (!isValid) {
          socket.emit("error", {
            event: params.event,
            details: formatedDetails,
          });
          return;
        }
      }

      const { payload, cb } = extractPayloadAndCb(args);

      if (isExpectCb(params)) {
        if (!cb || typeof cb !== "function") {
          _socket.emit("error", {
            event: params.event,
            details: [
              {
                path: "",
                keyword: ValueErrorType[21], // Function
                message: "Expected callback as last parameter",
              },
            ],
          });
          return;
        }

        await params.handler(payload, cb);
      } else {
        await params.handler(payload);
      }
    };

    _socket.on(params.event, listener);
  }

  const socket = _socket as CustomSocket;

  socket.customOn = customOn as CustomOn;

  return socket;
}

export { enhanceSocket };
