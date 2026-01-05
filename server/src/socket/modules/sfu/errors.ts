export const ApiSfuErrors = {
  router: {
    CANNOT_CONSUME_PRODUCER: {
      code: "MEDIASOUP_ROUTER_CANNOT_CONSUME_PRODUCER",
      message: "Cannot consume the provided producer",
    },
    NOT_FOUND: {
      code: "MEDIASOUP_ROUTER_NOT_FOUND",
      message: "Could not get room router. Please try again later.",
    },
  },
  transport: {
    NOT_FOUND: {
      code: "MEDIASOUP_TRANSPORT_NOT_FOUND",
      message: "Transport with this ID does not exist",
    },
    SEND_TRANSPORT_NOT_FOUND: {
      code: "MEDIASOUP_SEND_TRANSPORT_NOT_FOUND",
      message: "Send transport has not been created",
    },
  },
  consumer: {
    NOT_FOUND: {
      code: "MEDIASOUP_CONSUMER_NOT_FOUND",
      message: "Consumer with this ID does not exist",
    },
  },
};
