  UPDATE auth.users                                                                                                                                    
  SET phone_change = ''                                                                                                                                
  WHERE email = 'user@example.com'
    AND phone_change IS NULL;