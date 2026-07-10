import { NextResponse } from 'next/server';
import { saveUserLogin } from '../../../services/supabaseService';

export async function POST(request: Request) {
  try {
    const { name, captchaInput } = await request.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!captchaInput || typeof captchaInput !== 'string' || !captchaInput.trim()) {
      return NextResponse.json({ error: 'Captcha input is required' }, { status: 400 });
    }

    const result = await saveUserLogin(name.trim(), captchaInput.trim());
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to save login' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('[Login Route Error]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
