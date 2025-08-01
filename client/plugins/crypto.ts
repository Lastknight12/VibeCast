export default defineNuxtPlugin(() => {
  let cryptoImpl: Window["crypto"] | Crypto;

  if (import.meta.server) {
    // Node.js crypto
    cryptoImpl = require("crypto");
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
