import { Database } from "./database.ts";

export type Notification = Database["public"]["Tables"]["notification"]["Row"];

export type Profiles = Database["public"]["Tables"]["profiles"]["Row"];
