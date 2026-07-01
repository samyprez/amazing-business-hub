import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/setup-profile';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // token_hash flow (used by invite emails)
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'invite' | 'email' });
    if (!error) {
      return NextResponse.redirect(`${origin}/setup-profile`);
    }
  }

  return NextResponse.redirect(`${origin}/login?message=Invalid+or+expired+invite+link`);
}
