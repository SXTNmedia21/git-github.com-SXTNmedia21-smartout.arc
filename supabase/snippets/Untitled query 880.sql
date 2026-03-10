    UPDATE public.user_identity
  SET is_godmode = true
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@smartout.local');