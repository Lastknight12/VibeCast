import { TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { logger } from "src/lib/logger";
import { ApiCoreErrors } from "../../errors";
import { extractPayloadAndCb } from "./utils";
import { CustomSocket } from "../../enhanceSocket";
import { Params } from "./types";
export * from "./types";

export class SocketError extends Error {
  code: string;
  constructor(error: { code: string; message: string }) {
    super(error.message);
    this.code = error.code;
  }
}

const schemasCache = new Map<
  TSchema,
  ReturnType<typeof TypeCompiler.Compile>
>();

export function customOn<
  Schema extends TSchema,
  ProtectedEvent extends boolean,
>(this: CustomSocket, params: Params<Schema, ProtectedEvent>): void {
  if (params.config?.schema && !schemasCache.has(params.config.schema)) {
    const schema = TypeCompiler.Compile(params.config.schema);
    schemasCache.set(params.config.schema, schema);
  }

  const listener = async (...args: unknown[]) => {
    const { payload, cb } = extractPayloadAndCb(args);

    if (params.config?.protected && !this.data.user) {
    }

    if (params.config?.schema) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const validator = schemasCache.get(params.config.schema)!;
      const isValid = validator.Check(payload);

      if (!isValid) {
        this.emit("error", {
          event: params.event,
          error: {
            code: "INVALID_PAYLOAD",
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            message: validator.Errors(payload).First()!.message,
          },
        });
        return;
      }
    }

    try {
      const childLogger = logger.child({
        type: "socket",
        event: params.event,
      });

      if (!cb || typeof cb !== "function") {
        this.emit("error", {
          event: params.event,
          error: new SocketError(ApiCoreErrors.INVALID_CALLBACK),
        });
        return;
      }

      await params.handler(
        {
          data: payload,
          context: { logger: childLogger, user: this.data.user as never },
        },
        cb,
      );
    } catch (error) {
      logger.error(error);
      if (error instanceof SocketError) {
        if (cb) {
          cb({
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

        this.emit("error", {
          event: params.event,
          error: { code: error.code, message: error.message },
        });
      } else {
        this.emit("error", {
          event: params.event,
          error: new SocketError(ApiCoreErrors.UNEXPECTED_ERROR),
        });
      }
    }
  };

  this.on(params.event, listener);
}
