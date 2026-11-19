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
    if (!supabaseUrl || !publishableKey) {
      return respond({ error: "Konfigurasi Supabase untuk fungsi AI belum tersedia." }, 500);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond({ error: "Sesi login tidak valid. Silakan masuk kembali." }, 401);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return respond({ error: "Fitur AI belum diaktifkan. Admin perlu menambahkan OPENAI_API_KEY di Supabase Edge Function Secrets." }, 503);

    const body = await req.json();
    const topic = String(body.topic || "").trim().slice(0, 3000);
    const duration = Math.min(15, Math.max(5, Number(body.duration) || 8));
    const style = String(body.style || "Dokumenter sinematik").slice(0, 80);
    if (!topic) return respond({ error: "Topik video wajib diisi." }, 400);

    const prompt = `Buat naskah YouTube faceless berbahasa Indonesia untuk channel RUANG FAKTA, kanal edukasi tentang fakta unik, sains, misteri alam semesta, teknologi, dan sejarah.

TOPIK: ${topic}
DURASI TARGET: sekitar ${duration} menit
GAYA: ${style}

Susun naskah yang enak didengar, natural saat dibacakan voice-over, memiliki storytelling kuat, dan tidak bertele-tele. Gunakan struktur:
# Judul yang menarik
## Opening Hook (15-25 detik)
## Intro
## Bagian 1, 2, 3, dan seterusnya
## Closing dan ajakan berinteraksi
## Catatan verifikasi fakta

Untuk setiap klaim faktual yang tidak umum, tandai [PERLU VERIFIKASI] jika tidak yakin. Jangan mengarang kutipan, angka, nama penelitian, atau sumber. Bedakan fakta, hipotesis, dan spekulasi. Jangan menulis arahan visual kecuali singkat dalam tanda kurung siku. Targetkan panjang sesuai durasi dengan bahasa Indonesia yang hidup dan mudah dipahami.`;

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        max_output_tokens: Math.min(7000, duration * 650),
      }),
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error("OpenAI API error:", aiData?.error?.message || aiResponse.status);
      return respond({ error: "Layanan AI gagal membuat naskah. Periksa API key dan saldo akun API OpenAI." }, 502);
    }
    const script = (aiData.output || [])
      .flatMap((item: any) => item.content || [])
      .filter((item: any) => item.type === "output_text")
      .map((item: any) => item.text)
      .join("\n")
      .trim();

    if (!script) return respond({ error: "AI tidak mengembalikan teks. Silakan coba lagi." }, 502);
    return respond({ script });
  } catch (error) {
    console.error("generate-script error:", error);
    return respond({ error: "Terjadi kesalahan saat membuat naskah." }, 500);
  }
});
