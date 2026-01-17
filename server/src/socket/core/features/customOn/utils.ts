import { TSchema, Type } from "@sinclair/typebox";
import { CustomOnParams, HandlerCallback } from "./types";
import { Value } from "@sinclair/typebox/value";

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

export function isExpectCb<Schema extends TSchema>(
  p: CustomOnParams<boolean, Schema>,
): p is CustomOnParams<true, Schema> {
  if (p.config?.expectCb) {
    return p.config.expectCb === true;
  }

  return false;
}
