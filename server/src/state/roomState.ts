import { Adapter } from "./adapters/core/room";
import { RoomsAdapter } from "./adapters/MemoryAdapter/rooms";

export const rooms: Adapter = new RoomsAdapter();
