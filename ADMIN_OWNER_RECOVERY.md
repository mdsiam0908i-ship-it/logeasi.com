# Recover the existing LOGEASI root-owner login

This recovery flow resets credentials for the **already initialized permanent root owner**. It does not create another administrator or another root owner, and it does not recover the old password (passwords are stored as hashes).

## Safe recovery steps

1. Deploy this change to the same environment and database used by the app.
2. In the server/deployment secret settings, temporarily set `ROOT_ADMIN_RECOVERY_KEY` to a new random value with at least 32 characters. Generate one locally with `openssl rand -hex 32`; do not commit it or share it in chat.
3. Send a one-time HTTPS `POST` to `/api/admin/owner/recover-credentials`, providing the recovery key in the `x-root-recovery-key` header and a username/password you choose in the JSON body. Use a password manager to create a unique password of at least 12 characters. Example using environment variables locally:

   ```bash
   read -r -p 'New admin username: ' ADMIN_USERNAME
   read -r -s -p 'New admin password: ' ADMIN_PASSWORD; printf '\n'
   curl --fail-with-body --request POST "$APP_URL/api/admin/owner/recover-credentials" \
     --header "Content-Type: application/json" \
     --header "x-root-recovery-key: $ROOT_ADMIN_RECOVERY_KEY" \
     --data "$(jq -n --arg username "$ADMIN_USERNAME" --arg password "$ADMIN_PASSWORD" '{username:$username,password:$password}')"
   ```

   Username rules: 3–32 characters, lowercase letters, digits, dot, underscore, or hyphen. Password rules: 12–128 characters. The endpoint updates the existing root account's username and password hash, clears login lockout, and writes an audit event. It returns the username only, never the password.
4. After a successful response, immediately remove `ROOT_ADMIN_RECOVERY_KEY` from the deployment secrets and restart/redeploy the service. Then sign in at `/admin/login` with the username and password you chose.
5. Store the new password securely. If recovery returns an error, do not repeatedly retry; check the deployed service logs and verify the app uses the expected persistent database.

The recovery endpoint is rate-limited and refuses to operate unless the secret is configured, the root lock points to an existing root owner account, and the username is not already assigned to another user. Keep the key private and use HTTPS only.
