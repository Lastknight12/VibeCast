import fastifyCookie, { FastifyCookieOptions } from "@fastify/cookie";

export const autoConfig: FastifyCookieOptions = {
  secret: "secret",
  hook: "onRequest",
};

export default fastifyCookie;
