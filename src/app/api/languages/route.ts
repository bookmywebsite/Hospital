import { NextResponse } from 'next/server';
import { getSupportedLanguages } from '@/lib/voice/language-config';

// GET /api/languages
export async function GET() {
  const languages = getSupportedLanguages();
  return NextResponse.json({ success: true, languages });
}