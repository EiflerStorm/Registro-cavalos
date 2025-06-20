import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://emvcmaikymnoboxfpngg.supabase.co'; // Copie do seu painel do Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtdmNtYWlreW1ub2JveGZwbmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyNzc0MTgsImV4cCI6MjA2NTg1MzQxOH0.sgP5nSW6Uzi5yYcQUHs47dffXxEhbUYdlavxbsYRE0w'; // Copie do seu painel do Supabase

// Inicializa o cliente Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Você pode adicionar outras funções relacionadas ao Supabase aqui,
// como funções de login/logout, ou funções específicas para interagir com suas tabelas.