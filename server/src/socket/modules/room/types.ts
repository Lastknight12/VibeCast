import { User } from "better-auth/types";

export type RoomPeer = {
  user: Pick<User, "id" | "name" | "image">;
  producers: {
    audio?: string;
    screenShare?: { video: string; audio?: string };
  };
  voiceMuted: boolean;
};
