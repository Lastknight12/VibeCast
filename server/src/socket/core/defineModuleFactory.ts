import { TSchema } from "@sinclair/typebox";
import { GlobalContext } from "./globalContext";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { logger } from "src/lib/logger";
import { DefaultHandlerCb } from "./enhanceSocket";

export type HandlerInput<Data extends { payload?: any; cb?: any }> =
  "payload" extends keyof Data
    ? "cb" extends keyof Data
      ? { payload: Data["payload"]; cb: Data["cb"] }
      : { payload: Data["payload"] }
    : "cb" extends keyof Data
      ? { cb: Data["cb"] }
      : unknown;

type SocketConfig<Schema extends TSchema, ExpectCb extends boolean> = {
  schema?: Schema;
  expectCb?: ExpectCb;
};

export type ErrorCb = (data: { error?: string }) => void;
export type SocketHandlerMeta<
  Ctx extends object,
  Schema extends TSchema,
  ExpectCb extends boolean = false,
> = ExpectCb extends true
  ? {
      event: string;
      config?: SocketConfig<Schema, ExpectCb>;
      handler: (
        ctx: Ctx,
        params: {
          payload: any;
          cb: DefaultHandlerCb<any>;
        }
      ) => void | Promise<void>;
    }
  : {
      event: string;
      config?: SocketConfig<Schema, ExpectCb>;
      handler: (
        ctx: Ctx,
        params: {
          payload: any;
        }
      ) => void | Promise<void>;
    };

export function defineModuleFactory<Ctx extends GlobalContext>(data?: {
  createModuleContext?: (globalContext: GlobalContext) => Ctx;
}) {
  // SUGGESTION: maybe rename?
  const moduleMetas: SocketHandlerMeta<Ctx, TSchema, boolean>[] = [];
  // SUGGESTION: name it like validators?
  const schemasCache: Map<
    TSchema,
    ReturnType<typeof TypeCompiler.Compile>
  > = new Map();

  function defineSocketHandler<
    Schema extends TSchema,
    ExpectCb extends boolean = false,
  >(meta: SocketHandlerMeta<Ctx, Schema, ExpectCb>) {
    if (meta.config?.schema && !schemasCache.has(meta.config.schema)) {
      try {
        const validator = TypeCompiler.Compile(meta.config.schema);
        schemasCache.set(meta.config.schema, validator);
      } catch (err) {
        logger.error(
          `Failed to compile schema for handler: ${meta.event} - ${(err as Error).message}`
        );
      }
    }

    moduleMetas.push(meta);
    return meta;
  }

  return {
    defineSocketHandler,
    moduleMetas,
    schemasCache,
    ...data,
  };
}
