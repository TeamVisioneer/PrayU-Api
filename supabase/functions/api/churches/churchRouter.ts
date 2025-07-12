import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { searchChurches } from "./churchService.ts";

const churchRouter = new Hono();

// Search churches by name
churchRouter.get("/search", async (c) => {
  try {
    const searchName = c.req.query("name");

    if (!searchName) {
      return c.json({
        success: false,
        error: "Church name is required",
      }, 400);
    }

    const results = await searchChurches(searchName);

    return c.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error searching churches:", error);
    return c.json({
      success: false,
      error: error.message || "An error occurred while searching for churches",
    }, 500);
  }
});

export default churchRouter;
