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
    const topic = String(body.topic || "").trim().slice(0, 3000);
    const duration = Math.min(15, Math.max(5, Number(body.duration) || 8));
    const style = String(body.style || "Dokumenter sinematik").slice(0, 80);
    if (!topic) return respond({ error: "Topik video wajib diisi." }, 400);

    const prompt = [
      "Kamu adalah produser video YouTube faceless profesional untuk RUANG FAKTA, channel edukasi Indonesia tentang fakta unik, sains, misteri alam semesta, teknologi, dan sejarah.",
      "",
      "Buat paket produksi lengkap berdasarkan:",
      "TOPIK: " + topic,
      "DURASI: sekitar " + duration + " menit",
      "GAYA: " + style,
      "",
      "Kembalikan HANYA JSON valid tanpa markdown fence atau teks di luar JSON, dengan struktur persis:",
      '{"working_title":"judul kerja","title_options":["5 pilihan judul YouTube yang menarik dan tidak menyesatkan"],"description":"deskripsi YouTube 2-3 paragraf, termasuk ajakan subscribe dan catatan verifikasi bila perlu","tags":["10-15 tag relevan"],"thumbnail":{"concept":"konsep thumbnail singkat","image_prompt":"prompt gambar thumbnail sinematik 16:9, tanpa teks, tanpa watermark, komposisi jelas dan kontras tinggi","text_overlay":"maksimal 4 kata untuk teks thumbnail"},"scenes":[{"scene_number":1,"section":"Hook / Intro / Isi / Closing","estimated_seconds":20,"visual_direction":"apa yang terlihat di adegan","image_prompt":"prompt visual detail untuk image generator, konsisten, cinematic, 16:9","camera_motion":"gerakan kamera atau static","voiceover":"narasi bahasa Indonesia yang siap dibacakan","sound_design":"musik dan efek suara yang disarankan"}],"production_notes":["catatan produksi dan fakta yang harus diverifikasi"]}',
      "",
      "Buat 8-14 adegan sesuai durasi. Setiap voiceover harus berisi narasi yang substansial, bukan placeholder. Total estimasi durasi adegan mendekati durasi target. Gunakan detail visual spesifik dan beragam. Jangan mengarang data, kutipan, atau sumber; tandai klaim yang perlu diverifikasi. Pisahkan fakta, hipotesis, dan spekulasi."
    ].join("\n");

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        max_output_tokens: Math.min(9000, duration * 850),
      }),
    });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error("OpenAI production error:", aiData?.error?.message || aiResponse.status);
      return respond({ error: "AI gagal menyusun paket produksi. Periksa saldo API OpenAI." }, 502);
    }
    const raw = (aiData.output || [])
      .flatMap((item: any) => item.content || [])
      .filter((item: any) => item.type === "output_text")
      .map((item: any) => item.text)
      .join("\n").trim();
    if (!raw) return respond({ error: "AI tidak mengembalikan paket produksi." }, 502);

    let production;
    try {
      let cleaned = raw.trim();
      const fence = String.fromCharCode(96).repeat(3);
      if (cleaned.startsWith(fence)) cleaned = cleaned.slice(cleaned.indexOf("\n") + 1).replace(new RegExp("\\n" + fence + "\\s*$"), "");
      production = JSON.parse(cleaned);
    } catch {
      console.error("Production JSON parse failed");
      return respond({ error: "Format hasil AI tidak terbaca. Silakan klik Buat Paket Produksi sekali lagi." }, 502);
    }
    if (!Array.isArray(production.scenes) || !production.thumbnail || !Array.isArray(production.title_options)) {
      return respond({ error: "Paket produksi belum lengkap. Silakan coba lagi." }, 502);
    }
    return respond({ production });
  } catch (error) {
    console.error("generate-production error:", error);
    return respond({ error: "Terjadi kesalahan saat membuat paket produksi." }, 500);
  }
});