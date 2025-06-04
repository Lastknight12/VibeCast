import { ExtendedError, Socket } from "socket.io";
import { auth } from "../lib/auth";

export async function socketGuard(
  socket: Socket,
  next: (err?: ExtendedError) => void
) {
  try {
    const headers = new Headers();

    // Parse Socket headers to Headers type
    for (const [key, value] of Object.entries(socket.handshake.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else if (typeof value === "string") {
        headers.append(key, value);
      }
    }

    const session = await auth.api.getSession({
      headers,
    });

    if (!session || !session.user) {
      return next(new Error("Unauthorized"));
    }

    socket.data.user = session.user;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
}
