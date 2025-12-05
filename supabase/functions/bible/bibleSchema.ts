import { z } from "npm:zod";

export const BibleSearchResponse = z.object({
  data: z.array(z.object({
    longLabel: z.string(),
    chapter: z.number(),
    paragraph: z.number(),
  })),
});
