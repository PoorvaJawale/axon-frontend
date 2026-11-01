/* eslint-disable @typescript-eslint/no-require-imports */
// Pinned operator inspection/staging. Private CA/server keys never leave Railway.
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const commands = {
  activate: `set -euo pipefail
dir=/var/lib/postgresql/data/certs
test -s "$dir/axon-hostnames.crt"
test ! -e "$dir/server.before-axon-hostnames.crt"
pending=$(psql -U "$PGUSER" -d "$PGDATABASE" -Atc 'SELECT count(*) FROM pg_settings WHERE pending_restart')
errors=$(psql -U "$PGUSER" -d "$PGDATABASE" -Atc 'SELECT count(*) FROM pg_file_settings WHERE error IS NOT NULL')
test "$pending" = 0 && test "$errors" = 0
openssl verify -CAfile "$dir/root.crt" -verify_hostname tokaido.proxy.rlwy.net "$dir/axon-hostnames.crt"
key_hash=$(openssl pkey -in "$dir/server.key" -pubout 2>/dev/null | openssl sha256)
cert_hash=$(openssl x509 -in "$dir/axon-hostnames.crt" -pubkey -noout | openssl sha256)
test "$key_hash" = "$cert_hash"
cp -p "$dir/server.crt" "$dir/server.before-axon-hostnames.crt"
cp -p "$dir/axon-hostnames.crt" "$dir/server.crt.next"
mv "$dir/server.crt.next" "$dir/server.crt"
rollback() {
  cp -p "$dir/server.before-axon-hostnames.crt" "$dir/server.crt.rollback"
  mv "$dir/server.crt.rollback" "$dir/server.crt"
  psql -U "$PGUSER" -d "$PGDATABASE" -Atc 'SELECT pg_reload_conf()' >/dev/null
  printf '%s\\n' 'TLS verification failed; previous certificate restored.'
  exit 1
}
psql -U "$PGUSER" -d "$PGDATABASE" -Atc 'SELECT pg_reload_conf()' >/dev/null || rollback
sleep 1
openssl s_client -starttls postgres -connect 127.0.0.1:5432 -servername tokaido.proxy.rlwy.net -verify_hostname tokaido.proxy.rlwy.net -CAfile "$dir/root.crt" -verify_return_error </dev/null >/dev/null 2>&1 || rollback
printf '%s\\n' 'Certificate activated; new connection verified against existing CA and public hostname. Previous certificate retained.'
`,
  inspect: `set -euo pipefail
psql -U "$PGUSER" -d "$PGDATABASE" -At <<'SQL'
SELECT name,setting,pending_restart FROM pg_settings WHERE name IN ('ssl','ssl_cert_file','ssl_key_file','ssl_ca_file');
SELECT 'config_errors',count(*) FROM pg_file_settings WHERE error IS NOT NULL;
SELECT 'pending_restart',count(*) FROM pg_settings WHERE pending_restart;
SQL
openssl x509 -in /var/lib/postgresql/data/certs/root.crt -noout -subject -dates
openssl x509 -in /var/lib/postgresql/data/certs/server.crt -noout -subject -dates -ext subjectAltName
`,
  stage: `set -euo pipefail
dir=/var/lib/postgresql/data/certs
test -s "$dir/root.crt" && test -s "$dir/root.key" && test -s "$dir/server.key"
test ! -e "$dir/axon-hostnames.crt"
umask 077
openssl req -new -key "$dir/server.key" -out "$dir/axon-hostnames.csr" -subj /CN=tokaido.proxy.rlwy.net
printf '%s\\n' 'subjectAltName=DNS:tokaido.proxy.rlwy.net,DNS:postgres-k-cw.railway.internal,DNS:localhost' 'extendedKeyUsage=serverAuth' 'keyUsage=digitalSignature,keyEncipherment' > "$dir/axon-hostnames.ext"
openssl x509 -req -in "$dir/axon-hostnames.csr" -CA "$dir/root.crt" -CAkey "$dir/root.key" -set_serial "0x$(openssl rand -hex 16)" -days 365 -extfile "$dir/axon-hostnames.ext" -out "$dir/axon-hostnames.crt"
chown --reference="$dir/server.crt" "$dir/axon-hostnames.crt"
chmod --reference="$dir/server.crt" "$dir/axon-hostnames.crt"
openssl verify -CAfile "$dir/root.crt" -verify_hostname tokaido.proxy.rlwy.net "$dir/axon-hostnames.crt"
openssl verify -CAfile "$dir/root.crt" -verify_hostname postgres-k-cw.railway.internal "$dir/axon-hostnames.crt"
openssl x509 -in "$dir/axon-hostnames.crt" -noout -subject -dates -ext subjectAltName
printf '%s\\n' 'Certificate staged only. Active certificate unchanged.'
`,
};
const target = process.argv[3] || "appdb";
const service = {
  appdb: "34c598c5-2293-4024-baeb-0b48a9b78677",
  metadata: "8903014e-6048-4f1f-b792-c5f8045b177a",
  metadata18: "af53601a-765e-4d4e-b855-641f803d757c",
}[target];
if (!service) throw Error("Select appdb, metadata or metadata18");
const command = commands[process.argv[2]]?.replaceAll(
  "postgres-k-cw.railway.internal",
  {
    appdb: "postgres-k-cw.railway.internal",
    metadata: "postgres.railway.internal",
    metadata18: "axon-n8n-metadata18.railway.internal",
  }[target],
);
if (!command) {
  console.error("Use inspect, stage or activate");
  process.exit(1);
}
const encoded = Buffer.from(command).toString("base64");
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
const result = spawnSync(
  exe,
  [
    "ssh",
    "--project",
    "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
    "--environment",
    "692d14bf-022f-4bb5-9f14-702f8ee8b606",
    "--service",
    service,
    "--",
    `printf '%s' '${encoded}' | base64 -d | bash`,
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 90_000,
    maxBuffer: 1024 * 1024,
  },
);
// These commands emit only configuration names, public identities and counts.
if (result.stdout) process.stdout.write(result.stdout);
if (result.status !== 0 || result.error) {
  console.error("TLS operation failed; stop before activating changes.");
  process.exitCode = 1;
}
