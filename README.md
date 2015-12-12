**This installation guide is only suitable to set up bustabit for development and testing. Additional steps are necessary for a production-ready bustabit.**

## 1. Install Dependencies

If `bustabit-depositor` is used, `bitcoind` must be installed and running.

#### Debian
    sudo apt-get install git postgresql postgresql-9.4-plv8 nodejs-legacy npm

#### Mac OS
Download and install [Postgres.app](http://postgresapp.com) and [set up the command line tools](http://postgresapp.com/documentation/cli-tools.html). The remaining dependencies can be installed using Homebrew:

    brew install git node

## 2. Clone Source
    git clone https://github.com/moneypot/bustabit-webserver.git
    git clone https://github.com/moneypot/bustabit-gameserver.git
    git clone https://github.com/moneypot/bustabit-depositor.git

`bustabit-depositor` is only needed if payments are to be accepted and may be omitted otherwise.

Run `npm install` once from within each project directory to install all required npm modules.

## 3. Initialise Database

#### Debian
    sudo -u postgres createuser -P bustabit
    sudo -u postgres createdb -O bustabit bustabitdb
    sudo -u postgres createlang plv8 bustabitdb
    psql -W -U bustabit -d bustabitdb -h localhost -f bustabit-webserver/server/sql/schema.sql

#### Mac OS
    createuser -P bustabit
    createdb -O bustabit bustabitdb
    createlang plv8 bustabitdb
    psql -W -U bustabit -d bustabitdb -h localhost -f bustabit-webserver/server/sql/schema.sql

## 4. Configure and Start Components

All instructions should be followed from within the respective project directories.

#### bustabit-webserver
Set the database URI, replacing `<PASSWORD>` with the one you chose in step 3.

    export DATABASE_URL=postgres://bustabit:<PASSWORD>@localhost/bustabitdb

Set an extended public key as defined by BIP 32 (starts with `xpub`). All deposit addresses will be derived from this key:

    export BIP32_DERIVED_KEY=xpub…

By default, bustabit listens for HTTP requests on port 3841. Optionally, a different port may be specified, for example:

    export PORT=8000

Finally, start the server:

    npm start

#### bustabit-gameserver

Generate a hashchain (see [this forum post](https://bitcointalk.org/index.php?topic=922898.0) for more information on bustabit's probably fair scheme):

    node populate_hashes.js

Set the same database URI as in the previous step and start the server:

    export DATABASE_URL=postgres://bustabit:<PASSWORD>@localhost/bustabitdb
    npm start

#### bustabit-depositor
Edit the variables in the `env` file to suit your needs:

- `BIP32_DERIVED_KEY` An extended public key. This should be the same key used in the `bustabit-webserver` section above.
- `GENERATE_ADDRESSES` Number of addresses to generate and watch. This number should be greater than the number of your users.
- `BITCOIND_HOST` The address at which your `bitcoind` instance is listening at
- `BITCOIND_USER` and `BITCOIND_PASS` The RPC credentials of your `bitcoind` instance. These should be identical to the credentials defined in `bitcoind`'s configuration file.

Finally, start the depositor in the background with `npm start` or in the foreground using `npm run start-dev`.
