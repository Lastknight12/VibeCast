import { TSchema } from "@sinclair/typebox";
import { GlobalContext, DefaultHandlerCb } from "src/socket/core";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { logger } from "src/lib/logger";

export type HandlerInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Data extends { payload?: any; cb?: DefaultHandlerCb },
> = "payload" extends keyof Data
  ? "cb" extends keyof Data
    ? { payload: Data["payload"]; cb: Data["cb"] }
    : { payload: Data["payload"] }
  : "cb" extends keyof Data
    ? { cb: Data["cb"] }
    : never;

export interface SocketConfig<ExpectCb extends boolean> {
  schema?: TSchema;
  expectCb?: ExpectCb;
}

export type HandlerMeta<
  Ctx extends object,
  ExpectCb extends boolean = false,
> = ExpectCb extends true
  ? {
      event: string;
      config?: SocketConfig<ExpectCb>;
      handler: (
        ctx: Ctx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: HandlerInput<{ payload: any; cb: DefaultHandlerCb }>
      ) => void | Promise<void>;
    }
  : {
      event: string;
      config?: SocketConfig<ExpectCb>;
      handler: (
        ctx: Ctx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        params: HandlerInput<{ payload: any }>
      ) => void | Promise<void>;
    };

export function defineModuleFactory<Ctx extends GlobalContext>(data?: {
  createModuleContext?: (globalContext: GlobalContext) => Ctx;
}) {
  const moduleMetas: (HandlerMeta<Ctx, true> | HandlerMeta<Ctx, false>)[] = [];

  const schemasCache = new Map<
    TSchema,
    ReturnType<typeof TypeCompiler.Compile>
  >();

  function defineSocketHandler<ExpectCb extends boolean = false>(
    meta: HandlerMeta<Ctx, ExpectCb>
  ) {
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
