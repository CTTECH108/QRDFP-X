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
  const path = url.pathname.replace(/^\/mongo-rooms\/?/, "");

  try {
    const db = await getDb();
    const rooms = db.collection("rooms");

    // GET /mongo-rooms — list all rooms
    if (req.method === "GET") {
      const data = await rooms.find({}).sort({ created_at: 1 }).toArray();
      return new Response(JSON.stringify(
        data.map((r) => ({ ...r, id: r._id.toString(), _id: undefined }))
      ), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /mongo-rooms — create room
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.name?.trim()) {
        return new Response(JSON.stringify({ error: "Name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const doc = {
        name: body.name.trim(),
        created_by: body.created_by,
        created_at: new Date().toISOString(),
      };
      const result = await rooms.insertOne(doc);
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
