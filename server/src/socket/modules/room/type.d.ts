import { User } from "better-auth/types";

type RoomType = "public" | "private";

export interface ClientToServerEvents {
  createRoom: (
    roomName: string,
    roomType: RoomType,
    cb: (result: { error: string }) => void
  ) => void;
  joinRoom: (roomname: string, cb: (result: { error: string }) => void) => void;
  getAllRooms: (
    cb: (
      data: Record<
        string,
        {
          peers: Record<string, User>;
        }
      >
    ) => void
  ) => void;
  getRoomPeers: (
    cb: (
      peers: Array<{
        user: Pick<User, "id" | "name" | "image">;
        voiceMuted: boolean;
        producers: { audio?: { id: string }; video?: { id: string } };
      }>
    ) => void
  ) => void;
}

export interface ServerToClientEvents {
  roomCreated: (roomName: string) => void;
  userJoined: (data: { user: User }) => void;
  userJoinRoom: (
    roomName: string,
    data: {
      id: string;
      name: string;
      image: string;
    }
  ) => void;
}
