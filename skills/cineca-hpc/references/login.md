# Login, 2FA and SSH

CINECA requires 2FA. Each session the Smallstep client (`step`) fetches a 12-hour SSH **certificate**
once the browser has taken the SSO password and a 6-digit OTP, and `ssh` logs in with it: no password
is typed at the cluster. The everyday commands are in `SKILL.md`.

## One-time setup

1. **Activate 2FA** at <https://sso.hpc.cineca.it>: log in, set a new password, scan the QR code into
   an authenticator app (Google Authenticator, FreeOTP), save the recovery codes. The SSO password is
   separate from the UserDB portal password. If the first access fails, email superc@cineca.it for a
   valid link.
2. **Install the Smallstep CLI** from Smallstep's package for the machine's CPU:
   ```bash
   wget https://dl.smallstep.com/cli/docs-cli-install/latest/step-cli_amd64.deb   # arm64: step-cli_arm64.deb
   sudo dpkg -i step-cli_amd64.deb
   ```
   Not `apt install step`: that is an unrelated package.
3. **Bootstrap CINECA's CA** (writes `ca-url`, `fingerprint` and `root` into
   `~/.step/config/defaults.json`):
   ```bash
   step ca bootstrap --ca-url=https://sshproxy.hpc.cineca.it \
     --fingerprint 2ae1543202304d3f434bdc1a2c92eff2cd2b02110206ef06317e70c1c1735ecd
   ```
4. **Store the certificate identity** in the same `defaults.json`, so `step ssh login` takes no
   arguments (step reads any of its flags from this file):
   ```json
   "identity": "<the email registered in UserDB>",
   "provisioner": "cineca-hpc"
   ```
5. **Store the cluster username** in `~/.ssh/config`; every CINECA login node uses the same one:
   ```
   Host login.leonardo.cineca.it login.marconi.cineca.it login.g100.cineca.it login.pitagora.cineca.it
       User <cluster username>
   ```

## Troubleshooting

**"Could not open a connection to your authentication agent"** — no ssh-agent in this terminal:
`eval $(ssh-agent)`, then `step ssh login`, then `ssh`.

**"REMOTE HOST IDENTIFICATION HAS CHANGED"** — a login name covers several machines with different
host keys, so this is expected, not an attack. Drop the stale key:
`ssh-keygen -R login.leonardo.cineca.it`. Adding `StrictHostKeyChecking accept-new` and
`UserKnownHostsFile /dev/null` to the `Host` block silences it for good, at the cost of never checking
these hosts' keys.

**"no separate private key for certificate"** (after `Server accepts key`) — the cluster accepted the
certificate, but the agent lost its key, usually because several stray agents are running:
`pkill ssh-agent`, then the everyday login again.

**It asks for a password** — no certificate is loaded, or the username is wrong (the SSO portal name
instead of the cluster username). Load the certificate first, and check the username as `SKILL.md` shows.

**"Invalid username or password" in the browser** — the SSO password is wrong or expired; it is not
the UserDB password. Reset it at <https://sso.hpc.cineca.it>.

**The certificate expired** — after 12 hours or a reboot: `eval $(ssh-agent)` and `step ssh login`.
No new bootstrap.
