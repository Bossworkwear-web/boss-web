import { NextResponse } from "next/server";

type AddressComponent = {
  long_name: string;
  types: string[];
};

type PlaceResult = {
  address_components?: AddressComponent[];
};

function getComponent(components: AddressComponent[], type: string) {
  return components.find((item) => item.types.includes(type))?.long_name ?? "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") ?? "").trim();

  if (!placeId) {
    return NextResponse.json({ ok: false });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ ok: false });
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(placeId)}` +
      "&fields=address_component" +
      `&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ ok: false });
    }

    const data = (await response.json()) as { result?: PlaceResult };
    const components = data.result?.address_components ?? [];

    const streetNumber = getComponent(components, "street_number");
    const route = getComponent(components, "route");
    const address1 = [streetNumber, route].filter(Boolean).join(" ").trim();
    const suburb =
      getComponent(components, "locality") ||
      getComponent(components, "sublocality") ||
      getComponent(components, "administrative_area_level_2");
    const postcode = getComponent(components, "postal_code");
    const state = getComponent(components, "administrative_area_level_1");
    const country = getComponent(components, "country");

    return NextResponse.json({
      ok: true,
      address: {
        address1,
        suburb,
        postcode,
        state,
        country,
      },
    });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
