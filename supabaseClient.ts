import { createClient } from '@supabase/supabase-js';

// Access environment variables with import.meta.env (Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Faltan variables de entorno de Supabase. La aplicación podría no funcionar correctamente.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
