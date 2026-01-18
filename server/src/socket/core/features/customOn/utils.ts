import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { HandlerCallback } from "./types";

const PlainObject = Type.Object({}, { additionalProperties: true });

export function extractPayloadAndCb(args: unknown[]): {
  payload?: object;
  cb?: HandlerCallback<unknown>;
} {
  const cb: HandlerCallback<unknown> | undefined =
    (args.findLast(
      (elem) => typeof elem === "function",
    ) as HandlerCallback<unknown>) ?? undefined;

  const payload = Value.Check(PlainObject, args[0]) ? args[0] : undefined;

  return { payload, cb };
}
