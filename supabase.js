// ── Supabase client ──────────────────────────────────────────────
const SUPABASE_URL = 'https://fhjtkjayyugaepdkhfmd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0iKtrS0UMh62RFWbHkKfqA__198cNkB';

// Load Supabase from CDN then expose globally
const supabaseScript = document.createElement('script');
supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
supabaseScript.onload = () => {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.dispatchEvent(new Event('supabase-ready'));
};
document.head.appendChild(supabaseScript);
