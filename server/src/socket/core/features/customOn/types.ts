import { Static, TSchema } from "@sinclair/typebox";
import { User } from "better-auth/types";
import pino from "pino";

interface Context<ProtectedEvent extends boolean> {
  logger: pino.Logger;
  user: ProtectedEvent extends true
    ? User & {
        roomId?: string;
      }
    : undefined;
}

interface HandlerError {
  code: string;
  message: string;
}

export type HandlerCallback<Data = unknown> = (result: {
  data?: Data;
  errors?: HandlerError[];
}) => void;

export interface Params<
  Schema extends TSchema,
  ProtectedEvent extends boolean,
> {
  event: string;
  config?: {
    schema?: Schema;
    protected?: ProtectedEvent;
  };
  handler: (
    input: {
      data: Static<Schema>;
      context: Context<ProtectedEvent>;
    },
    cb: HandlerCallback,
  ) => void | Promise<void>;
}
