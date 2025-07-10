import { User } from "better-auth/types";
import { Server, type Socket } from "socket.io";
import { EventsMap } from "socket.io/dist/typed-events";
import { Static, TSchema } from "@sinclair/typebox";
import { HandlerCb } from "src/socket/core/defineModuleFactory";
import { TypeCheck, TypeCompiler } from "@sinclair/typebox/compiler";
import { ServerToClientEvents } from "src/socket/core/types";
import { enhanceSocket } from "src/socket/core";
import { CustomSocketOn } from "src/socket/core/enhanceSocket";

export interface SocketWrapper<CTS extends EventsMap, STC extends EventsMap>
  extends Socket<CTS, STC, any, SocketData> {
  customOn: CustomSocketOn;
}

export type CustomSocket<
  ClientToServerEvents extends EventsMap = any,
  ServerToClientEvents extends EventsMap = ServerToClientEvents,
> = SocketWrapper<ClientToServerEvents, ServerToClientEvents>;
