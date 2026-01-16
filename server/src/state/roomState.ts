import { RoomsAdapter } from "./adapters/core/room";
import { RoomsMemoryAdapter } from "./adapters/MemoryAdapter/rooms";

export const rooms: RoomsAdapter = new RoomsMemoryAdapter();
