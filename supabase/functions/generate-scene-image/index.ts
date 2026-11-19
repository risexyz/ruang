import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return respond({ error: "Silakan masuk terlebih dahulu." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!publishableKey) {
      try {
        const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
        publishableKey = keys.default;
      } catch { /* handled below */ }
    }
    if (!supabaseUrl || !publishableKey) return respond({ error: "Konfigurasi Supabase belum tersedia." }, 500);

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond({ error: "Sesi login tidak valid. Silakan masuk kembali." }, 401);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return respond({ error: "OPENAI_API_KEY belum diatur pada Supabase Edge Function Secrets." }, 503);

    const body = await req.json();
    const prompt = String(body.prompt || "").trim().slice(0, 6000);
    const videoId = String(body.videoId || "").trim().slice(0, 100);
    const sceneNumber = Math.min(99, Math.max(1, Math.floor(Number(body.sceneNumber) || 1)));
    if (!prompt) return respond({ error: "Prompt gambar adegan masih kosong." }, 400);
    if (!videoId) return respond({ error: "Konten video belum dipilih." }, 400);

    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-2.5-flare",
        prompt: prompt + "\n\nCreate one cinematic documentary still for a factual Indonesian YouTube video. Landscape 16:9 composition, no captions, no typography, no logo, no watermark. Photorealistic where appropriate, visually coherent, detailed, and suitable for educational documentary use.",
        size: "1536x1024",
        quality: "low",
        output_format: "webp",
        output_compression: 82,
        n: 1,
        user: authData.user.id,
      }),
    });
    const imageData = await imageResponse.json();
    if (!imageResponse.ok) {
      console.error("OpenAI image error:", imageData?.error?.message || imageResponse.status);
      return respond({ error: "Gagal membuat gambar AI. Periksa saldo dan akses API OpenAI." }, 502);
    }

    const encoded = imageData?.data?.[0]?.b64_json;
    if (!encoded) return respond({ error: "OpenAI tidak mengembalikan file gambar." }, 502);

    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const path = authData.user.id + "/" + videoId + "/scene-" + sceneNumber + "-" + Date.now() + ".webp";
    const { error: uploadError } = await userClient.storage.from("production-assets").upload(
      path,
      new Blob([bytes], { type: "image/webp" }),
      { contentType: "image/webp", cacheControl: "3600", upsert: false },
    );
    if (uploadError) {
      console.error("Scene image storage error:", uploadError.message);
      return respond({ error: "Gambar berhasil dibuat tetapi gagal disimpan: " + uploadError.message }, 500);
    }

    const { data: signedData, error: signedError } = await userClient.storage
      .from("production-assets")
      .createSignedUrl(path, 3600);
    if (signedError || !signedData?.signedUrl) {
      return respond({ error: "Gambar tersimpan, tetapi pratinjau belum dapat dibuat." }, 500);
    }

    return respond({ image_path: path, image_url: signedData.signedUrl });
  } catch (error) {
    console.error("generate-scene-image error:", error);
    return respond({ error: "Terjadi kesalahan saat membuat gambar adegan." }, 500);
  }
});
