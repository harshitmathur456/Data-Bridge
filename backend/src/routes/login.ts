import { Router, Request, Response } from 'express';
import { saveUserLogin } from '../services/supabaseService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, captchaInput } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!captchaInput || typeof captchaInput !== 'string' || !captchaInput.trim()) {
      return res.status(400).json({ error: 'Captcha input is required' });
    }

    const result = await saveUserLogin(name.trim(), captchaInput.trim());
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to save login' });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[Login Route Error]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
