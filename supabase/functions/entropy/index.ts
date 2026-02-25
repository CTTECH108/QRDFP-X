import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory entropy store
let latestEntropy: { data: Uint8Array; timestamp: number } | null = null;
const ENTROPY_FRESHNESS_MS = 60000; // 60 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    if (req.method === 'POST' && path === 'entropy') {
      // Receive entropy from ESP32
      const body = await req.arrayBuffer();
      const entropy = new Uint8Array(body);

      if (entropy.length !== 32) {
        return new Response(
          JSON.stringify({ error: 'Invalid entropy size. Expected 32 bytes.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate entropy isn't all zeros or all ones
      const allZeros = entropy.every(b => b === 0);
      const allOnes = entropy.every(b => b === 0xFF);
      if (allZeros || allOnes) {
        return new Response(
          JSON.stringify({ error: 'Invalid entropy: degenerate data detected.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      latestEntropy = { data: entropy, timestamp: Date.now() };

      // Log to database using service role
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Hash the entropy for logging (never store raw entropy)
      const hashBuffer = await crypto.subtle.digest('SHA-256', entropy);
      const hashArray = new Uint8Array(hashBuffer);
      const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

      await supabaseAdmin.from('entropy_log').insert({
        entropy_hash: hashHex,
        source: 'hardware',
        is_valid: true,
      });

      return new Response(
        JSON.stringify({ status: 'ok', message: 'Entropy received and validated.', hash: hashHex }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET' && path === 'entropy') {
      // Return entropy status (not the actual entropy!)
      const isFresh = latestEntropy && (Date.now() - latestEntropy.timestamp) < ENTROPY_FRESHNESS_MS;

      return new Response(
        JSON.stringify({
          source: isFresh ? 'hardware' : 'software',
          fresh: !!isFresh,
          lastUpdate: latestEntropy?.timestamp ?? null,
          staleness: latestEntropy ? Date.now() - latestEntropy.timestamp : null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && path === 'derive-key') {
      // Derive a session key from entropy
      const { salt } = await req.json();
      
      let entropySource = 'software';
      let keyMaterial: Uint8Array;

      const isFresh = latestEntropy && (Date.now() - latestEntropy.timestamp) < ENTROPY_FRESHNESS_MS;

      if (isFresh && latestEntropy) {
        keyMaterial = latestEntropy.data;
        entropySource = 'hardware';
        // Invalidate after use to prevent replay
        latestEntropy = null;
      } else {
        // Software fallback
        keyMaterial = new Uint8Array(32);
        crypto.getRandomValues(keyMaterial);
      }

      // Use HKDF to derive key
      const baseKey = await crypto.subtle.importKey('raw', keyMaterial, 'HKDF', false, ['deriveBits']);
      const saltBuffer = new TextEncoder().encode(salt || 'qrng-session-salt');
      const info = new TextEncoder().encode('qrng-aes-256-gcm');

      const derivedBits = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: saltBuffer, info },
        baseKey,
        256
      );

      const derivedKeyHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      return new Response(
        JSON.stringify({ key: derivedKeyHex, source: entropySource }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
