import { NextResponse } from "next/server";

type GooglePrediction = {
  description: string;
  place_id: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(q)}` +
      "&components=country:au" +
      "&types=address" +
      `&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = (await response.json()) as { predictions?: GooglePrediction[] };
    const suggestions = (data.predictions ?? []).slice(0, 5).map((item) => ({
      description: item.description,
      placeId: item.place_id,
    }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
