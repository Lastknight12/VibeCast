import { Socket } from "socket.io";
import { DefaultEventsMap, EventsMap } from "socket.io/dist/typed-events";
import { CustomSocket, SocketData } from "src/types/socket";
import { EventError, HandlerCallback } from "src/socket/core";
import { ServerToClientEvents } from "src/types/socket";
import { TypeCompiler, ValueErrorType } from "@sinclair/typebox/compiler";
import { Static, TSchema } from "@sinclair/typebox";

export interface CustomOnConfig<Schema extends TSchema> {
  schema?: Schema;
  protected?: boolean;
}

export interface CustomOnParams<Schema extends TSchema> {
  event: string;
  config?: CustomOnConfig<Schema>;
  handler: (data: Static<Schema>) => unknown;
}

export type CustomOn = <Schema extends TSchema>(
  params: CustomOnParams<Schema>
) => void;

function isPlainObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractPayloadAndCb(args: unknown[]) {
  const cb: HandlerCallback<unknown> | undefined =
    (args.findLast(
      (elem) => typeof elem === "function"
    ) as HandlerCallback<unknown>) ?? undefined;

  const payload = isPlainObject(args[0]) ? args[0] : undefined;

  return { payload, cb };
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
    params: CustomOnParams<Schema>
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

      if (params.config?.schema) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const validator = schemasCache.get(params.config.schema)!;
        const isValid = validator.Check(payload);

        const formatedDetails: EventError["details"] = [];

        for (const error of validator.Errors(payload)) {
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

      try {
        const data = await params.handler(payload);

        cb({ data, errors: undefined });
      } catch (error) {
        if (error instanceof SocketError) {
          cb({
            data: undefined,
            errors: [{ code: error.code, message: error.message }],
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
