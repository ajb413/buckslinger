const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
let db;

// const sampleUser = {
//   verifier_id: process.env.MY_EMAIL,
//   user_name: 'ajb413',
//   email: process.env.MY_EMAIL,
//   bank_account: '0123456789',
//   onchain_account: '0x705a9CD6Ff3aC3891362217F01670f6a38820Ff2',
//   ens: 'ajb413',
// };

const sampleUser = {
  verifier_id: 'bob@bob.com',
  user_name: 'itsmebob',
  email: 'bob@bob.com',
  bank_account: '0123456799',
  onchain_account: '0xdeadbeef',
  ens: 'itsmebob',
};

function createUserTableIfNotExists() {
  return new Promise((resolve) => {
    db.prepare(`CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY,
        verifier_id TEXT UNIQUE,
        account_balance REAL,
        earning BOOLEAN,
        user_name TEXT,
        email TEXT,
        bank_account TEXT,
        onchain_account TEXT,
        ens TEXT
      );`).run((err) => {
      if (err) console.log('create table err', err);
      resolve();
    });
  });
}

function createDepositsTableIfNotExists() {
  return new Promise((resolve) => {
    db.prepare(`CREATE TABLE IF NOT EXISTS deposits (
        id INTEGER PRIMARY KEY,
        userId INTEGER,
        amount TEXT,
        type TEXT,
        account TEXT
      );`).run((err) => {
      if (err) console.log('create table err', err);
      resolve();
    });
  });
}

function getFirstUserRow() {
  return new Promise((resolve) => {
    db.get(`SELECT * FROM user;`, (err, rows) => {
      if (err) console.log('select user rows err', err);

      if (!rows) {
        resolve(false);
      } else {
        resolve(rows);
      }
    });
  });
}

function insertSeedUser() {
  return new Promise((resolve) => {
    const seedUserInsert = `
      INSERT INTO
        user (
          verifier_id,
          user_name,
          email,
          bank_account,
          onchain_account,
          ens
        ) VALUES (
          '${sampleUser.verifier_id}',
          '${sampleUser.user_name}',
          '${sampleUser.email}',
          '${sampleUser.bank_account}',
          '${sampleUser.onchain_account}',
          '${sampleUser.ens}'
        );
      `;

    db.prepare(seedUserInsert).run((err) => {
      if (err) console.log('seed insert err', err);
      resolve();
    });
  });
}

module.exports = {
  seed: (_path) => {
    return new Promise(async (resolve) => {
      db = new sqlite3.Database(_path);

      if (fs.existsSync(_path)) {
        console.log('DB file exists');
      } else {
        console.log('Creating DB file');
        fs.openSync(_path, 'w');
      }

      await createUserTableIfNotExists();
      await createDepositsTableIfNotExists();

      const rows = await getFirstUserRow();

      if (rows) {
        console.log('seed row already exists');
        resolve();
      } else {
        await insertSeedUser();
        console.log('inserting seed row...');
        resolve();
      }

      // db.close();
    });
  }
};