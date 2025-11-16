export const ApiRoomErrors = {
  UNSAFE_NAME: {
    code: "UNSAFE_NAME",
    message:
      "Invalid room name. Only letters, numbers, -, _, ., ~ are allowed name. Only letters, numbers, underscores (_), hyphens (-), slashes (/), and periods (.) are allowed. Consecutive periods (..) are not permitted.",
  },
  ALREADY_EXISTS: {
    code: "ROOM_ALREADY_EXISTS",
    message: "Room with the provided name already exists.",
  },
  USER_NOT_IN_ROOM: {
    code: "ROOM_USER_NOT_IN_ROOM",
    message: "You are not in this room.",
  },
  NOT_FOUND: {
    code: "ROOM_NOT_FOUND",
    message: "Room not found.",
  },
  ROUTER_NOT_FOUND: {
    code: "ROOM_ROUTER_NOT_FOUND",
    message: "Could not get room router. Please try again later.",
  },
};
