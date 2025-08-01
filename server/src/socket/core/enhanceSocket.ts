import { Socket } from "socket.io";
import { DefaultEventsMap, EventsMap } from "socket.io/dist/typed-events";
import { CustomSocket, SocketData } from "src/types/socket";
import { HandlerCallback } from "src/socket/core";
import { ServerToClientEvents } from "src/types/socket";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Static, TSchema } from "@sinclair/typebox";
import { errors } from "../modules/errors";

export interface CustomOnConfig<
  Schema extends TSchema,
  ExpectCb extends boolean,
> {
  schema?: Schema;
  expectCb?: ExpectCb;
  protected?: boolean;
}

export interface CustomOnParams<
  ExpectCb extends boolean,
  Schema extends TSchema,
> {
  event: string;
  config?: CustomOnConfig<Schema, ExpectCb>;
  handler: ExpectCb extends true
    ? (
        data: Static<Schema>,
        cb: HandlerCallback<unknown>
      ) => void | Promise<void>
    : (data: Static<Schema>) => void | Promise<void>;
}

export type CustomOn = <
  Schema extends TSchema,
  ExpectCb extends boolean = false,
>(
  params: CustomOnParams<ExpectCb, Schema>
) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractPayloadAndCb(args: unknown[]): {
  payload?: object;
  cb?: HandlerCallback<unknown>;
} {
  const cb: HandlerCallback<unknown> | undefined =
    (args.findLast(
      (elem) => typeof elem === "function"
    ) as HandlerCallback<unknown>) ?? undefined;

  const payload = isPlainObject(args[0]) ? args[0] : undefined;

  return { payload, cb };
}

function isExpectCb<Schema extends TSchema>(
  p: CustomOnParams<boolean, Schema>
): p is CustomOnParams<true, Schema> {
  if (p.config?.expectCb) {
    return p.config.expectCb === true;
  }

  return false;
}

export class SocketError extends Error {
  code: string;
  constructor(error: { code: string; message: string }) {
    super(error.message);
    this.code = error.code;
  }
}

function enhanceSocket(
  _socket: Socket<EventsMap, ServerToClientEvents, DefaultEventsMap, SocketData>
): CustomSocket {
  const schemasCache = new Map<
    TSchema,
    ReturnType<typeof TypeCompiler.Compile>
  >();

  function customOn<Schema extends TSchema>(
    params: CustomOnParams<true, Schema> | CustomOnParams<false, Schema>
  ): void {
    if (params.config?.schema && !schemasCache.has(params.config.schema)) {
      // TODO: rebuild??
      const schema = TypeCompiler.Compile(params.config.schema);
      schemasCache.set(params.config.schema, schema);
    }

    const listener = async (...args: unknown[]) => {
      const { payload, cb } = extractPayloadAndCb(args);

      if (params.config?.protected && !_socket.data.user) {
        return;
      }

      if (params.config?.schema) {
        const validator = schemasCache.get(params.config.schema)!;
        const isValid = validator.Check(payload);

        if (!isValid) {
          socket.emit("error", {
            event: params.event,
            error: {
              code: "INVALID_PAYLOAD",
              message: validator.Errors(payload).First()?.message,
            },
          });
          return;
        }
      }

      try {
        if (isExpectCb(params)) {
          if (!cb || typeof cb !== "function") {
            _socket.emit("error", {
              event: params.event,
              error: new SocketError(errors.core.INVALID_CALLBACK),
            });
            return;
          }

          await params.handler(payload, cb);
        } else {
          await params.handler(payload);
        }
      } catch (error) {
        if (error instanceof SocketError) {
          if (params.config?.expectCb) {
            cb?.({
              data: undefined,
              errors: [
                {
                  code: error.code,
                  message: error.message,
                },
              ],
            });
            return;
          }

          _socket.emit("error", {
            event: params.event,
            error: { code: error.code, message: error.message },
          });
        } else {
          _socket.emit("error", {
            event: params.event,
            error: new SocketError(errors.core.UNEXPECTED_ERROR),
          });
        }
      }
    };

    _socket.on(params.event, listener);
  }

  const socket = _socket as CustomSocket;

  socket.customOn = customOn as CustomOn;

  return socket;
}

export { enhanceSocket };
