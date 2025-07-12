interface Church {
  name: string;
  group: string;
  address: string;
  phone: string;
  pastor: string;
  detailUrl: string;
}

/**
 * Search for churches by name from ch114.kr
 * @param churchName The name of the church to search for
 * @returns Array of church information
 */
export async function searchChurches(churchName: string): Promise<Church[]> {
  try {
    // Encode the church name for URL
    const encodedName = encodeURIComponent(churchName);
    const url = `https://ch114.kr/churchSearch.php?church_nm=${encodedName}`;

    // Fetch the HTML content
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch church data: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();

    // Parse the HTML to extract church information
    const churches = parseChurchesFromHtml(html);

    return churches;
  } catch (error) {
    console.error("Error in searchChurches:", error);
    throw error;
  }
}

/**
 * Parse the HTML to extract church information
 * @param html The HTML content from ch114.kr
 * @returns Array of parsed church information
 */
function parseChurchesFromHtml(html: string): Church[] {
  const churches: Church[] = [];

  try {
    // Find the table in the HTML
    const tableRegex = /<tbody>([\s\S]*?)<\/tbody>/;
    const tableMatch = html.match(tableRegex);

    if (!tableMatch || !tableMatch[1]) {
      return churches;
    }

    const tableContent = tableMatch[1];

    // Find all rows in the table
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowContent = rowMatch[1];

      // Extract all cells from the row
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        cells.push(cellMatch[1].trim());
      }

      // Extract detail URL from the last cell
      const detailUrlMatch = cells[5]?.match(/href="([^"]+)"/);
      const detailUrl = detailUrlMatch ? detailUrlMatch[1] : "";

      if (cells.length >= 5) {
        // Clean up pastor name (remove "목사" suffix)
        const pastorName = cells[4].replace(" 목사", "");

        // Extract postal code and address
        const addressWithPostal = cells[2];
        const postalCodeMatch = addressWithPostal.match(/\((\d+)\)/);
        const address = addressWithPostal.replace(/\(\d+\)\s*/, "");

        churches.push({
          name: cells[0],
          group: cells[1],
          address: address,
          phone: cells[3],
          pastor: pastorName,
          detailUrl: detailUrl.startsWith("/")
            ? `https://ch114.kr${detailUrl}`
            : detailUrl,
        });
      }
    }

    return churches;
  } catch (error) {
    console.error("Error parsing HTML:", error);
    return churches;
  }
}
