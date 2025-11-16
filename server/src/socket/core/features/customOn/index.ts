import { TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { logger } from "src/lib/logger";
import { ApiCoreErrors } from "../../errors";
import { CustomOnParams } from "./types";
import { extractPayloadAndCb, isExpectCb } from "./utils";
import { CustomSocket } from "../../enhanceSocket";

class SocketError extends Error {
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

function customOn<Schema extends TSchema>(
  params: CustomOnParams<false, Schema>
): void;
function customOn<Schema extends TSchema>(
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  params: CustomOnParams<true, Schema>
): void;
function customOn<Schema extends TSchema>(
  this: CustomSocket,
  params: CustomOnParams<true, Schema> | CustomOnParams<false, Schema>
): void {
  if (params.config?.schema && !schemasCache.has(params.config.schema)) {
    const schema = TypeCompiler.Compile(params.config.schema);
    schemasCache.set(params.config.schema, schema);
  }

  const listener = async (...args: unknown[]) => {
    const { payload, cb } = extractPayloadAndCb(args);

    if (params.config?.protected && !this.data.user) {
      return;
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
        payload,
      });

      if (isExpectCb(params)) {
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
            context: { logger: childLogger },
          },
          cb
        );
      } else {
        await params.handler({
          data: payload,
          context: { logger: childLogger },
        });
      }
    } catch (error) {
      logger.error(error);
      if (error instanceof SocketError) {
        if (params.config?.expectCb && cb) {
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

export * from "./types";
export { customOn, SocketError };
