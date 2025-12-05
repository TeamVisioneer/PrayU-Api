import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { authMiddleware } from "../_shared/authMiddleware.ts";
import { BibleController } from "./bibleController.ts";

const bibleApp = new Hono();
const bibleController = new BibleController();

bibleApp.use("*", authMiddleware);
bibleApp.post("/bible", (c) => bibleController.searchBible(c));

Deno.serve(bibleApp.fetch);
