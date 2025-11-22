import { Static, TSchema } from "@sinclair/typebox";
import pino from "pino";

export interface Context {
  logger: pino.Logger;
}

interface HandlerError {
  code: string;
  message: string;
}

export type HandlerCallback<Data> = (result: {
  data: Data;
  errors?: HandlerError[];
}) => void;

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
        input: { data: Static<Schema>; context: Context },
        cb: HandlerCallback<unknown>
      ) => void | Promise<void>
    : (input: {
        data: Static<Schema>;
        context: Context;
      }) => void | Promise<void>;
}
