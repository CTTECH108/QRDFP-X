import { MongoClient } from "npm:mongodb@6";

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

  try {
    const db = await getDb();
    const files = db.collection("file_transfers");

    // GET — list files for a room
    if (req.method === "GET") {
      const filter: Record<string, unknown> = {};
      if (roomId) filter.room_id = roomId;
      const data = await files.find(filter).sort({ created_at: -1 }).limit(100).toArray();
      return new Response(JSON.stringify(
        data.map((f) => ({ ...f, id: f._id.toString(), _id: undefined }))
      ), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST — insert file metadata
    if (req.method === "POST") {
      const body = await req.json();
      const required = ["uploader_id", "uploader_name", "original_name", "encrypted_path", "iv", "file_size", "entropy_source"];
      for (const field of required) {
        if (body[field] === undefined) {
          return new Response(JSON.stringify({ error: `${field} required` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      const doc = {
        room_id: body.room_id || null,
        uploader_id: body.uploader_id,
        uploader_name: body.uploader_name,
        original_name: body.original_name,
        encrypted_path: body.encrypted_path,
        iv: body.iv,
        file_size: body.file_size,
        entropy_source: body.entropy_source,
        created_at: new Date().toISOString(),
      };
      const result = await files.insertOne(doc);
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
