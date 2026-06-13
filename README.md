<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [KeePass4Web](#keepass4web)
  - [FEATURES](#features)
  - [INSTALL](#install)
  - [BUILD FRONTEND](#build-frontend)
  - [CONFIGURATION](#configuration)
  - [DEPLOYMENT](#deployment)
    - [Container](#container)
    - [Docker Compose — htpasswd (default)](#docker-compose--htpasswd-default)
    - [Docker Compose — LDAP (OpenLDAP)](#docker-compose--ldap-openldap)
    - [Docker Compose — OIDC (Keycloak)](#docker-compose--oidc-keycloak)
    - [Classic](#classic)
  - [BACKENDS](#backends)
    - [Authentication Backends](#authentication-backends)
    - [Database Backends](#database-backends)
  - [MISC](#misc)
  - [LIMITATIONS](#limitations)
  - [APP DETAILS / BACKGROUND](#app-details--background)
    - [Sequence of client/server operations](#sequence-of-clientserver-operations)
  - [COPYRIGHT AND LICENSING](#copyright-and-licensing)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# KeePass4Web

A mobile-friendly web application that serves KeePass database on a web frontend.

Written in Rust and JavaScript.

## FEATURES

- Doesn't save master password/keyfile, uses a new and unique encryption key to cache the database
- Encryption key is stored securely in the kernel keyring
- Server revokes encryption keys after a configurable user idle time, effectively removing access to the cached database
- Web interface offers entry search and access to files stored inside the database. Also displays custom entry icons

![Login](doc/img/login.png)

![App](doc/img/app.png)

## INSTALL

- From container image:
  See [DEPLOYMENT](#deployment)

- From source:
    - Clone the repo to some dir
      > git clone https://github.com/lixmal/keepass4web-rs.git

      > cd keepass4web-rs

    - Follow [BUILD FRONTEND](#build-frontend), [DEPLOYMENT](#deployment) in that order

## BUILD FRONTEND

The minified, bundled file will be written to public/scripts/bundle.js

- Install Node/npm, e.g. for Ubuntu
  > sudo apt-get install npm

- Install js modules
  > npm install

- Copy bootstrap font files
  > cp node_modules/bootstrap/fonts/* public/fonts/

- Build js bundle
  > npm run build

- For a non-uglified version you can run
  > npm run dev

## CONFIGURATION

Copy `config.example.yml` to `config.yml` and edit as needed. The example file contains
ready-to-use snippets for every supported backend, with values that match the bundled
docker-compose test services so you can test any backend with minimal changes.

The default `config.yml` uses htpasswd authentication. See `config.example.yml` for
LDAP and OIDC examples and documentation of every option.

## DEPLOYMENT

### Container

See [GitHub Packages](https://ghcr.io/lixmal/keepass4web-rs)

The image ships with the default config in `/conf/config.yml`, which should be overwritten with a mount/volume.

The app makes use of the [Linux kernel keyring](https://man7.org/linux/man-pages/man7/keyrings.7.html).

The keyring is currently not namespaced, hence container tooling deactivate the specific syscalls by default.
To make the app run you will need to activate the syscalls by creating a custom seccomp profile and passing the path to
the container runtime:

- [Docker](https://docs.docker.com/engine/security/seccomp/)
- [podman](https://docs.podman.io/en/v4.6.0/markdown/options/seccomp-policy.html)

A base file for extension can be found [here](https://github.com/moby/moby/blob/master/profiles/seccomp/default.json),
see the `syscalls` section.

The required syscalls are:

- keyctl
- add_key
- request_key

There's an example seccomp profile [seccomp/keyring.json](seccomp/keyring.json) in the repo.

**Make sure no other containers are running under the same user, or they will be able to access keys stored for
keepass4web**.

This is best achieved by running rootless containers with a dedicated user for keepass4web.

- [Docker](https://docs.docker.com/engine/security/rootless/)
- [podman](https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md)

Example docker:

    docker run \
      -p 8080:8080 -v ./config.yml:/conf/config.yml \
      -v ./tests/test.kdbx:/db.kdbx \
      --security-opt seccomp=seccomp/keyring.json \
      ghcr.io/lixmal/keepass4web-rs:master

Example podman:

    podman run \
      --userns=keep-id \
      -p 8080:8080 -v ./config.yml:/conf/config.yml \
      -v ./tests/test.kdbx:/db.kdbx \
      --security-opt seccomp=seccomp/keyring.json \
      ghcr.io/lixmal/keepass4web-rs:master

(master password: `test`)

> **Docker Desktop on macOS / Windows:** the kernel keyring syscalls are blocked by default.
> Set `use_keyring: false` in `config.yml` to use the in-memory key store instead.

### Docker Compose — htpasswd (default)

The bundled `docker-compose.yml` starts the app with local htpasswd authentication:

```bash
# 1. Create a password file (bcrypt)
htpasswd -cB .htpasswd <username>

# 2. Start the stack
docker-compose up -d
```

App is available at <http://localhost:8080> (KeePass master password: `test`).

To stop:

```bash
docker-compose down
```

### Docker Compose — LDAP (OpenLDAP)

The repo ships a pre-configured OpenLDAP test service. Enable it with these steps:

```bash
# 1. Copy example credentials (safe defaults for local testing)
cp .env.example .env

# 2. Uncomment the 'openldap' service block in docker-compose.yml

# 3. Switch config.yml to LDAP — replace auth_backend and add the LDAP block:
cat >> config.yml <<'EOF'

auth_backend: 'LDAP'
LDAP:
  uri: 'ldap://openldap:1389'
  scope: 'subtree'
  base_dn: 'ou=users,dc=example,dc=org'
  filter: '(objectClass=inetOrgPerson)'
  login_attribute: 'uid'
  bind: 'cn=admin,dc=example,dc=org'
  password: 'adminpassword'
EOF

# 4. Start the stack
docker-compose up -d
```

Log in with the test user defined in `.env` (`LDAP_TEST_USER` / `LDAP_TEST_PASSWORD`,
defaults `testuser` / `testpass`).

For a full LDAP config reference including Active Directory and per-user database
attributes see `config.example.yml`.

### Docker Compose — OIDC (Keycloak)

The repo ships a Keycloak instance with a pre-imported realm (`keepass`) and a
pre-configured client (`keepass4web`). Enable it with these steps:

```bash
# 1. Copy example credentials (safe defaults for local testing)
cp .env.example .env

# 2. Uncomment the 'keycloak' service block in docker-compose.yml

# 3. Switch config.yml to OIDC — replace auth_backend and add the OIDC block:
cat >> config.yml <<'EOF'

auth_backend: 'OIDC'
OIDC:
  issuer: 'http://keycloak:8180/realms/keepass'
  client_id: 'keepass4web'
  client_secret: 'insecure-example-client-secret'
  save_id_token: true
  scopes:
    - 'profile'

# OIDC redirect flow requires lax cookie policy
cookie_samesite: 'lax'
EOF

# 4. Start the stack (Keycloak takes ~30 s to start)
docker-compose up -d
```

- App: <http://localhost:8080> — log in with `testuser` / `testpass`
- Keycloak admin console: <http://localhost:8180> — credentials from `.env`
  (`KC_ADMIN_USERNAME` / `KC_ADMIN_PASSWORD`, defaults `admin` / `admin`)

For a full OIDC config reference see `config.example.yml`.

> **Note:** if you run the app outside docker-compose, replace `keycloak` in the
> issuer URL with `localhost`: `http://localhost:8180/realms/keepass`.

### Classic

This requires rust installed. Compile and run the binary:

```bash
cargo build --bins --release
./target/release/keepass4web-rs
```

## BACKENDS

### Authentication Backends

* **Htpasswd**
    * Authenticates users against a `.htpasswd` file.

* **LDAP**
    * Authenticates against external LDAP servers (Microsoft AD, OpenLDAP, etc.)
    * Provides customizable search filters, attribute mapping, and secure binding.

* **OIDC**
    * Authenticates users with a compatible OpenID Connect provider.
    * Retrieves user information, supports customizable scopes, CSRF protection, and logout functionality.

### Database Backends

* **Filesystem**
    * Retrieves KeePass databases from the local filesystem.
    * Can fetch database and keyfile locations from authentication backend or configuration.

* **HTTP**
    * Fetches KeePass databases over HTTP/HTTPS.
    * Supports basic authentication and bearer token mechanisms.

## MISC

- Show kernel keyrings in use (as root)
  > sudo cat /proc/keys

  > sudo cat /proc/key-users

## LIMITATIONS

- KeePass databases are read-only
- Limits of kernel keyring apply

## APP DETAILS / BACKGROUND

### Sequence of client/server operations

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    Note over C,S: Authentication Flow
    C->>S: Request KeePass tree
    S-->>C: Not authenticated
    Note over C: Show credentials dialog
    C->>S: User credentials
    Note over S: User auth (LDAP, SQL, ...)
    S-->>C: Login OK
    Note over C: Show backend login dialog
    C->>S: Backend credentials
    Note over S: Init DB backend / receive token
    S-->>C: Login OK
    Note over C: Show KeePass password dialog
    C->>S: KeePass credentials
    Note over S: Get KeePass database from backend<br/>Decrypt with master key + key file<br/>Encrypt with new key<br/>Store key in kernel keyring<br/>Write key ID to session<br/>Cache encrypted database
    S-->>C: Decryption OK
```

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    Note over C,S: Get Tree Flow
    C->>S: Request KeePass tree
    Note over S: Get database from cache<br/>Get key from keyring<br/>Decrypt database
    S-->>C: Send KeePass tree
    Note over C: Show KeePass tree
```

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    Note over C,S: Get Password Entry Flow
    Note over C: Password request by user
    C->>S: Request pw entry
    Note over S: Get key from keyring<br/>Get & decrypt database<br/>Decrypt requested password
    S-->>C: Send pw entry
    Note over C: Show cleartext pw
```


## COPYRIGHT AND LICENSING

This software is copyright (c) by Viktor Liu.
It is released under the terms of the GPL version 3.

Most of the icons in the `public/img/icons` directory are released under the LGPL version 2, the licence can be found in
the same directory.
The remaining icons are public domain.
As these icons are the same as the ones used by the original KeePass software, you can refer to the info
there: [Icon Acknowledgements](http://keepass.info/help/base/credits.html#icons).
