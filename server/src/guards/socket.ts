import { ExtendedError, Socket } from "socket.io";
import { logger } from "src/lib/logger";
import { auth } from "../lib/auth";

export async function socketGuard(
  socket: Socket,
  next: (err?: ExtendedError) => void,
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

    socket.data.user = session?.user
      ? { ...session.user, roomId: undefined }
      : undefined;
    next();
  } catch (error) {
    logger.error(error);
    next(new Error("Authentication error"));
  }
}
