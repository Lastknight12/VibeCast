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
      this.emit("error", ApiCoreErrors.UNAUTHORIZED);
      return;
    }

    if (params.config?.schema) {
      const validator = schemasCache.get(params.config.schema);
      if (!validator) {
        this.emit("error", ApiCoreErrors.UNEXPECTED_ERROR);
        return;
      }

      const isValid = validator.Check(payload);
      if (!isValid) {
        cb({
          data: undefined,
          errors: [
            {
              code: "INVALID_PAYLOAD",
              message:
                validator.Errors(payload).First()?.message ?? "Invalid payload",
            },
          ],
        });
        return;
      }
    }

    try {
      const childLogger = logger.child({
        type: "socket",
        event: params.event,
      });

      await params.handler(
        {
          data: payload,
          context: { logger: childLogger, user: this.data.user as never },
        },
        cb,
      );
    } catch (handlerError) {
      const socketError =
        handlerError instanceof SocketError
          ? handlerError
          : new SocketError(ApiCoreErrors.UNEXPECTED_ERROR);

      cb({
        data: undefined,
        errors: [socketError],
      });
    }
  };

  this.on(params.event, listener);
}
