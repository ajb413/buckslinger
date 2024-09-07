const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.DB_PATH;

function getUser(userVerifierId) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    db.get(`select * from user where verifier_id = '${userVerifierId}' limit 1;`, (err, rows) => {
      if (err) console.log('[DB] getUser err', err);

      if (!rows) {
        resolve(false);
      } else {
        resolve(rows);
      }
    });
  });
}

function getUserByUserName(username) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    db.get(`select * from user where user_name = '${username}' limit 1;`, (err, rows) => {

      if (err) console.log('[DB] getUserByUserName err', err);

      if (!rows) {
        resolve(false);
      } else {
        resolve(rows);
      }
    });
  });
}

function getUserById(id) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    db.get(`select * from user where id = ${+id} limit 1;`, (err, rows) => {

      if (err) console.log('[DB] getUserById err', err);

      if (!rows) {
        resolve(false);
      } else {
        resolve(rows);
      }
    });
  });
}

function setUserName(id, username) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    db.run(`
      UPDATE user
      SET user_name = '${username}'
      WHERE
          id = ${id};
    `, (err, rows) => {

      if (err) console.log('[DB] setUserName err', err);

      resolve();
    });
  });
}

function insertNewUser(userData) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    const seedUserInsert = `
      INSERT INTO
        user (
          verifier_id,
          email
        ) VALUES (
          '${userData.verifierId}',
          '${userData.email}'
        );
      `;

    db.prepare(seedUserInsert).run((err) => {
      if (err) console.log('[DB] insertNewUser err', err);
      resolve();
    });
  });
}

function setOrUpdateAccounts(id, account) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    const seedUserInsert = `
      UPDATE user
      SET
        bank_account = ${account.bankAccount ? "'" + account.bankAccount + "'" : 'null'},
        onchain_account = ${account.onchainAccount ? "'" + account.onchainAccount + "'" : 'null'},
        ens = ${account.ensAccount ? "'" + account.ensAccount + "'" : 'null'}
      WHERE
          id = ${id};
      `;

    db.prepare(seedUserInsert).run((err) => {
      if (err) console.log('[DB] setOrUpdateAccounts err', err);
      resolve();
    });
  });
}

// addNewDeposit
// user.id, amount, type_, account
function addNewDeposit(userId, amount, type_, account) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    const seedUserInsert = `
      INSERT INTO
        deposits (
          userId,
          amount,
          type,
          account
        ) VALUES (
          '${userId}',
          '${amount}',
          '${type_}',
          '${account}'
        );
      `;

    db.prepare(seedUserInsert).run((err) => {
      if (err) console.log('[DB] addNewDeposit err', err);
      resolve();
    });
  });
}

// account_balance
// updateAccountBalance
function updateAccountBalance(id, amount, type_) {
  return new Promise(async (resolve) => {
    const db = new sqlite3.Database(dbPath);
    const user = await getUserById(id);

    let balance = user.account_balance || 0;

    if (type_ === 'add') {
      balance += +amount;
    } else {
      balance -= +amount;
    }

    const query = `
      UPDATE user
      SET
        account_balance = ${balance}
      WHERE
          id = ${id};
      `;

    db.prepare(query).run((err) => {
      if (err) console.log('[DB] updateAccountBalance err', err);
      resolve();
    });

  });
}

module.exports = {
  getUser,
  setUserName,
  insertNewUser,
  getUserByUserName,
  setOrUpdateAccounts,
  addNewDeposit,
  updateAccountBalance,
};
