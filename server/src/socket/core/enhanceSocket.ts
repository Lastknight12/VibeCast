import { TSchema } from "@sinclair/typebox";
import { Socket } from "socket.io";
import { EventsMap } from "socket.io/dist/typed-events";
import { CustomSocket } from "src/types/socket";
import { EventError, ServerToClientEvents } from "./types";
import {
  TypeCheck,
  TypeCompiler,
  ValueErrorType,
} from "@sinclair/typebox/compiler";
import { User } from "better-auth/types";

export interface SocketData {
  user: User & {
    roomName?: string;
  };
}

export type SocketConfig<
  Schema extends ReturnType<typeof TypeCompiler.Compile>,
  ExpectCb extends boolean,
> = {
  schema?: Schema;
  expectCb?: ExpectCb;
};
export type DefaultHandlerCb<Data extends any> = (data: Data) => void;
export type CustomSocketOnEventParams<ExpectCb extends boolean = false> = {
  event: string;
  config?: SocketConfig<TypeCheck<TSchema>, ExpectCb>;
  handler: ExpectCb extends true
    ? (data: unknown, cb: DefaultHandlerCb<any>) => void | Promise<void>
    : (data: unknown) => void | Promise<void>;
};
export type CustomSocketOn = <ExpectCb extends true | false = false>(
  params: CustomSocketOnEventParams<ExpectCb>
) => void;

function handlerExpectsCb<Schema extends TypeCheck<TSchema>>(
  config?: SocketConfig<Schema, boolean>
): config is SocketConfig<Schema, true> {
  return config?.expectCb === true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractPayloadAndCb(args: unknown[]): {
  payload?: object;
  cb?: Function;
} {
  const last = args[args.length - 1];
  const cb = typeof last === "function" ? last : undefined;

  const payloadCandidate = cb ? args[0] : last;
  const payload = isPlainObject(payloadCandidate)
    ? payloadCandidate
    : undefined;

  return { payload, cb };
}

export type CustomOnEventConfig<
  Schema extends ReturnType<typeof TypeCompiler.Compile>,
  ExpectCb extends boolean,
> = {
  schema?: Schema;
  expectCb?: ExpectCb;
};

function enhanceSocket<
  CTS extends EventsMap,
  STC extends EventsMap = ServerToClientEvents,
>(socket: Socket<any, any, any, SocketData>): CustomSocket<CTS, STC> {
  function customOn<Schema extends ReturnType<typeof TypeCompiler.Compile>>(
    params: CustomSocketOnEventParams<true>
  ): void;

  function customOn<Schema extends ReturnType<typeof TypeCompiler.Compile>>(
    params: CustomSocketOnEventParams<false>
  ): void;

  function customOn(params: any): void {
    const listener = async (...args: any[]) => {
      if (params.config?.schema) {
        const userData = args[0];
        const validator = params.config.schema as TypeCheck<TSchema>;
        const isValid = validator.Check(userData);

        let formatedDetails: EventError["details"][] = [];

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
      if (handlerExpectsCb(params.config)) {
        if (!cb || typeof cb !== "function") {
          socket.emit("error", {
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

    socket.on(params.event, listener as any);
  }

  (socket as any).customOn = customOn;

  return socket as CustomSocket<any, ServerToClientEvents>;
}

export { enhanceSocket, handlerExpectsCb };
