await supabase.from("engine_authority_config").select("level").eq("capability", "x");
