import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    if (!TMDB_API_KEY) {
      throw new Error("TMDB_API_KEY is not configured");
    }

    const { query, type } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Searching TMDB for: ${query}, type: ${type || 'multi'}`);

    const searchType = type || "multi";
    const response = await fetch(
      `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
      {
        headers: {
          Authorization: `Bearer ${TMDB_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TMDB API error:", response.status, errorText);
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Get watch providers for each result
    const resultsWithProviders = await Promise.all(
      data.results.slice(0, 10).map(async (item: any) => {
        const mediaType = item.media_type || (searchType === "movie" ? "movie" : "tv");
        if (mediaType === "person") return null;
        
        try {
          const providersResponse = await fetch(
            `https://api.themoviedb.org/3/${mediaType}/${item.id}/watch/providers`,
            {
              headers: {
                Authorization: `Bearer ${TMDB_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          );
          
          const providersData = await providersResponse.json();
          const usProviders = providersData.results?.US?.flatrate || [];
          
          return {
            id: item.id.toString(),
            title: item.title || item.name,
            type: mediaType,
            year: (item.release_date || item.first_air_date || "").split("-")[0],
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : null,
            overview: item.overview,
            providers: usProviders.map((p: any) => ({
              id: p.provider_id,
              name: p.provider_name,
              logo: `https://image.tmdb.org/t/p/w45${p.logo_path}`,
            })),
          };
        } catch (e) {
          console.error(`Error fetching providers for ${item.id}:`, e);
          return {
            id: item.id.toString(),
            title: item.title || item.name,
            type: mediaType,
            year: (item.release_date || item.first_air_date || "").split("-")[0],
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : null,
            overview: item.overview,
            providers: [],
          };
        }
      })
    );

    const filteredResults = resultsWithProviders.filter(Boolean);
    console.log(`Found ${filteredResults.length} results`);

    return new Response(JSON.stringify({ results: filteredResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in tmdb-search:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
