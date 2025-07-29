export const errors = {
  room: {
    ALREADY_EXISTS: {
      code: "ROOM_ALREADY_EXISTS",
      message: "Room with the provided name already exists",
    },
    USER_NOT_IN_ROOM: {
      code: "ROOM_USER_NOT_IN_ROOM",
      message: "You are not in this room",
    },
    NOT_FOUND: {
      code: "ROOM_NOT_FOUND",
      message: "Room not found",
    },
    ROUTER_NOT_FOUND: {
      code: "ROOM_ROUTER_NOT_FOUND",
      message: "Could not get room router. Please try again later",
    },
  },

  mediasoup: {
    router: {
      CANNOT_CONSUME_PRODUCER: {
        code: "MEDIASOUP_ROUTER_CANNOT_CONSUME_PRODUCER",
        message: "Cannot consume the provided producer",
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
  },
};
