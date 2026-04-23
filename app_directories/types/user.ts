import { DateString } from "./types";
import type { DeviceBundle } from "./chat";

export interface User {
  id: string;
  name: string;
  email: string;
  banner: string | null | undefined;
  verified: boolean;
  img: string | null | undefined;
  bio: string | null | undefined;
  password?: string;
  username: string;
  refresh_token?: string;
  access_token?: string;
  createdAt: DateString | null;
  updatedAt: DateString | null;
  deletedAt: DateString | null;
  roomId: string;
  /** Active Olm devices for this user (populated when the server includes them). */
  devices?: DeviceBundle[];
}

export interface Author extends User, Record<string, unknown> {}
