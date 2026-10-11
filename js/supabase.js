import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phkrlnzwjkhxitzqjgkk.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_YtE6VSoNjxjJ55gQG4vWDw_Z0pevgjg';

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);