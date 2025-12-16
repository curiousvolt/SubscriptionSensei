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
    const searchUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TMDB API error:", response.status, errorText);
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    
    const resultsWithProviders = await Promise.all(
      data.results.slice(0, 10).map(async (item: any) => {
        const mediaType = item.media_type || (searchType === "movie" ? "movie" : "tv");
        if (mediaType === "person") return null;
        
        try {
          // Fetch watch providers
          const providersUrl = `https://api.themoviedb.org/3/${mediaType}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`;
          const providersResponse = await fetch(providersUrl);
          const providersData = await providersResponse.json();
          const usProviders = providersData.results?.US?.flatrate || [];

          let episodeCount: number | undefined;
          let totalWatchTimeMinutes: number | undefined;
          let seasonCount: number | undefined;

          if (mediaType === "tv") {
            // Fetch TV show details for episode count and runtime
            const tvDetailsUrl = `https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}`;
            const tvDetailsResponse = await fetch(tvDetailsUrl);
            const tvDetails = await tvDetailsResponse.json();

            seasonCount = tvDetails.number_of_seasons || 0;
            episodeCount = tvDetails.number_of_episodes || 0;
            
            // Calculate total watch time
            // Use episode_run_time array (can have multiple values for different episode lengths)
            const episodeRuntime = tvDetails.episode_run_time && tvDetails.episode_run_time.length > 0
              ? tvDetails.episode_run_time[0] // Average/typical episode runtime in minutes
              : 45; // Default to 45 minutes if not available

            if (episodeCount && episodeCount > 0) {
              totalWatchTimeMinutes = episodeCount * episodeRuntime;
            }

            console.log(`TV Show "${tvDetails.name}": ${seasonCount} seasons, ${episodeCount} episodes, ~${episodeRuntime}min/ep, total: ${totalWatchTimeMinutes}min`);
          } else if (mediaType === "movie") {
            // Fetch movie details for runtime
            const movieDetailsUrl = `https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_API_KEY}`;
            const movieDetailsResponse = await fetch(movieDetailsUrl);
            const movieDetails = await movieDetailsResponse.json();

            totalWatchTimeMinutes = movieDetails.runtime || 120; // Default to 120 minutes if not available
            console.log(`Movie "${movieDetails.title}": runtime ${totalWatchTimeMinutes}min`);
          }

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
            episodeCount,
            seasonCount,
            totalWatchTimeMinutes,
          };
        } catch (e) {
          console.error(`Error fetching details for ${item.id}:`, e);
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
