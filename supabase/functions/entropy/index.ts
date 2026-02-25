import { MongoClient } from "npm:mongodb@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENTROPY_BYTES = 32;
const ENTROPY_MAX_AGE_MS = 30_000;

let client: MongoClient | null = null;

async function getDb() {
  if (!client) {
    const uri = Deno.env.get("MONGODB_URI");
    if (!uri) throw new Error("MONGODB_URI not configured");
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db("qrng_comm");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── ESP32 POST: submit raw binary entropy ──────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.arrayBuffer();
      const bytes = new Uint8Array(body);

      if (bytes.length !== ENTROPY_BYTES) {
        return new Response(
          JSON.stringify({ error: `Invalid entropy size: expected ${ENTROPY_BYTES} bytes, got ${bytes.length}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const entropyHex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

      const db = await getDb();
      const col = db.collection("entropy_log");

      // Replay protection
      const existing = await col.findOne({ entropy_hex: entropyHex });
      if (existing) {
        return new Response(
          JSON.stringify({ error: "Entropy replay detected. Rejected." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await col.insertOne({
        entropy_hex: entropyHex,
        source: "hardware",
        used: false,
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, message: "Entropy accepted", bytes: ENTROPY_BYTES }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── GET: fetch fresh entropy for browser key derivation ───────────────
  if (req.method === "GET") {
    try {
      const db = await getDb();
      const col = db.collection("entropy_log");
      const cutoff = new Date(Date.now() - ENTROPY_MAX_AGE_MS).toISOString();

      const fresh = await col.findOne(
        { used: false, source: "hardware", created_at: { $gte: cutoff } },
        { sort: { created_at: -1 } }
      );

      if (fresh) {
        await col.updateOne({ _id: fresh._id }, { $set: { used: true } });
        return new Response(
          JSON.stringify({ source: "hardware", entropy_hex: fresh.entropy_hex, timestamp: fresh.created_at }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Software fallback
      const softBytes = new Uint8Array(ENTROPY_BYTES);
      crypto.getRandomValues(softBytes);
      const hex = Array.from(softBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

      return new Response(
        JSON.stringify({ source: "software", entropy_hex: hex, timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
