import { MongoClient, ObjectId } from "npm:mongodb@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  const url = new URL(req.url);
  const roomId = url.searchParams.get("room_id");
  const since = url.searchParams.get("since"); // ISO timestamp for polling
  const limit = parseInt(url.searchParams.get("limit") || "50");

  try {
    const db = await getDb();
    const messages = db.collection("messages");

    // GET — list messages for a room (optionally since a timestamp)
    if (req.method === "GET") {
      if (!roomId) {
        return new Response(JSON.stringify({ error: "room_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const filter: Record<string, unknown> = { room_id: roomId };
      if (since) filter.created_at = { $gt: since };

      const data = await messages
        .find(filter)
        .sort({ created_at: 1 })
        .limit(limit)
        .toArray();

      return new Response(JSON.stringify(
        data.map((m) => ({ ...m, id: m._id.toString(), _id: undefined }))
      ), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST — insert encrypted message
    if (req.method === "POST") {
      const body = await req.json();
      const required = ["room_id", "sender_id", "sender_name", "encrypted_payload", "iv", "entropy_source"];
      for (const field of required) {
        if (!body[field]) {
          return new Response(JSON.stringify({ error: `${field} required` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      const doc = {
        room_id: body.room_id,
        sender_id: body.sender_id,
        sender_name: body.sender_name,
        encrypted_payload: body.encrypted_payload,
        iv: body.iv,
        entropy_source: body.entropy_source,
        created_at: new Date().toISOString(),
      };
      const result = await messages.insertOne(doc);
      return new Response(JSON.stringify({ ...doc, id: result.insertedId.toString() }), {
        status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
