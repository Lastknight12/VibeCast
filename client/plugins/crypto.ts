export default defineNuxtPlugin(async () => {
  let cryptoImpl: Window["crypto"] | typeof import("crypto");

  if (import.meta.server) {
    // Node.js crypto
    cryptoImpl = await import("crypto");
  } else {
    // Browser Web Crypto API wrapper
    cryptoImpl = window.crypto;
  }

  return {
    provide: {
      crypto: cryptoImpl,
    },
  };
});
