-- Offline recovery prerequisite only. Logical dumps omit cluster roles.
-- NOLOGIN placeholders preserve ownership/ACLs without copying login secrets.
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['axon_web','axon_validator','axon_control','axon_validation','axon_n8n'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',role_name);
  END IF;
 END LOOP;
END $$;
