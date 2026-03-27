/**
 * Reverse geocode via OpenStreetMap Nominatim (usage policy: https://operations.osmfoundation.org/policies/nominatim/).
 * Browser requests should be low volume; identify your app if you scale up (e.g. proxy via your backend).
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "en" } }
    );

    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        pedestrian?: string;
        footway?: string;
        path?: string;
        house_number?: string;
        // In PH these can map to barangay / district-like regions depending on the POI.
        suburb?: string;
        neighbourhood?: string;
        quarter?: string;
        district?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        // Province-level in PH commonly maps to state/region.
        state?: string;
        region?: string;
        county?: string;
        country?: string;
      };
    };

    if (!data.address || Object.keys(data.address).length === 0) {
      return `${lat}, ${lng}`;
    }

    const address = data.address;

    const streetBase = address.road || address.pedestrian || address.footway || address.path || "";
    const street = [streetBase, address.house_number].filter(Boolean).join(" ").trim();
    const district = (address.suburb || address.neighbourhood || address.quarter || address.district || "").trim();
    const city = (address.city || address.town || address.village || address.municipality || "").trim();
    const province = (address.state || address.region || address.county || "").trim();
    let country = (address.country || "").trim();
    if (!country && data.display_name) {
      // Heuristic: Nominatim's display_name usually ends with the country.
      const lastPart = data.display_name.split(",").at(-1)?.trim();
      if (lastPart) country = lastPart;
    }

    const parts = [street, district, city, province, country].filter(Boolean);
    if (parts.length === 0) {
      // No usable address components.
      return `${lat}, ${lng}`;
    }

    // Example: "Street, District, City, Province, Philippines"
    return parts.join(", ");
  } catch (err) {
    console.error("Geocoding error:", err);
    return `${lat}, ${lng}`;
  }
}
