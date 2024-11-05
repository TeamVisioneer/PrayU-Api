export class PixelsClient {
  async searchPhotos(search: string, page: number) {
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${search}&page=${page}`,
        {
          headers: {
            Authorization: Deno.env.get("PEXELS_API_KEY") as string,
          },
        },
      );
      const data = await response.json();
      return data;
    } catch {
      return null;
    }
  }
}
