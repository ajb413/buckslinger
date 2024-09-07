const jose = require('jose');
const express = require('express');
const app = express();
const PORT = process.argv[2] || 3001;
const bodyParser = require('body-parser');

const DB_PATH = './buckslinger-sqlite.db';
process.env.DB_PATH = DB_PATH;
const db = require('./src/db-operations.js');
const { seed } = require('./src/seed.js');
const circle = require('./src/circle.js');
const { Web3 } = require('web3');

(async () => {
  await seed(DB_PATH);

  const jwtCheck = async (req, res, next) => {
        // idToken passed from the frontend in the Authorization header
    const idToken = req.headers.authorization.split(' ')[1];

    // app_pub_key passed from the frontend in the request body
    // const app_pub_key = req.body.appPubKey;
    const app_pub_key = 'test';

    // Get the JWKS used to sign the JWT issued by Web3Auth
    const jwks = jose.createRemoteJWKSet(new URL("https://api-auth.web3auth.io/jwks")); // for social logins

    // Verify the JWT using Web3Auth's JWKS
    let jwtDecoded;
    try {
      jwtDecoded = await jose.jwtVerify(idToken, jwks, { algorithms: ["ES256"] });
    } catch(err) {
      jwtDecoded = false;
    }

    req.jwtDecoded = jwtDecoded

    next();
  };

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get('/api/get-account', jwtCheck, async (req, res) => {
    // Checking `app_pub_key` against the decoded JWT wallet's public_key
    // use type === web3auth_threshold_key when working with CoreKitKey
    // if ((jwtDecoded.payload).wallets.find((x: { type: string }) => x.type === "web3auth_app_key").public_key.toLowerCase() === app_pub_key.toLowerCase()) {
    if (req.jwtDecoded) {
      // Verified
      const jwtDecoded = req.jwtDecoded;

      const verifierId = jwtDecoded.payload.verifierId;
      const email = jwtDecoded.payload.email;
      const expiration = +(jwtDecoded.payload.exp.toString() + '000');

      if (expiration > Date.now()) {
        try {
          const user = await db.getUser(verifierId);

          if (!user) {
            await db.insertNewUser({
              verifierId,
              email,
            });
          }

          const accounts = [];
          if (user.bank_account) {
            accounts.push({
              type: 'bank_account',
              value: user.bank_account // user.bank_account
            });
          }

          if (user.onchain_account) {
            accounts.push({
              type: 'onchain_account',
              value: user.onchain_account // user.onchain_account
            });
          }

          if (user.ens) {
            accounts.push({
              type: 'ens',
              value: user.ens // user.ens
            });
          }

          res.send({
            username: user.user_name,
            accounts,
          });
        } catch(err) {
          console.error('/api/get-account: [db.getUser]', err);
          return res.status(404).json({message: 'Not found'});
        }
      } else {
        return res.status(400).json({message: 'Verification Failed'});
      }
    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
    // res.send('hello world');
  });

  app.post('/api/set-username', jwtCheck, async (req, res) => {
    if (req.jwtDecoded) {
      if (
        !req.body.username ||
        typeof req.body.username !== 'string' ||
        req.body.username.length > 20 ||
        req.body.username.length < 3 ||
        !(/^[a-zA-Z0-9]+$/.test(req.body.username))
      ) {
        return res.status(400).json({message: 'Invalid User Name Choice'});
      }

      const alreadyUserName = await db.getUserByUserName(req.body.username);

      if (alreadyUserName) {
        return res.status(400).json({message: 'Username is already taken'});
      } else {
        const jwtDecoded = req.jwtDecoded;
        const verifierId = jwtDecoded.payload.verifierId;
        const user = await db.getUser(verifierId);
        try {
          await db.setUserName(user.id, req.body.username);
          return res.status(200).send({message: 'ok'});
        } catch(e) {
          return res.status(400).json({message: 'Username set failed'});
        }

      }
    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
  });

  app.post('/api/add-accounts', jwtCheck, async (req, res) => {
    if (req.jwtDecoded) {
      const jwtDecoded = req.jwtDecoded;
      const verifierId = jwtDecoded.payload.verifierId;
      const user = await db.getUser(verifierId);

      const bankAccount = req.body.bank_account || null;
      const onchainAccount = req.body.onchain_account || null;
      const ensAccount = req.body.ens || null;

      if (bankAccount || onchainAccount || ensAccount) {
        const accounts = {
          bankAccount,
          onchainAccount,
          ensAccount,
        };
        try {
          await db.setOrUpdateAccounts(user.id, accounts);
          return res.status(200).send({message: 'ok'});
        } catch(e) {
          console.error('/api/add-accounts [db.setOrUpdateAccounts]',e);
          return res.status(400).json({message: 'Account set/update failed'});
        }
      } else {
        return res.status(200).send({message: 'ok, no update'});
      }
    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
  });

  app.get('/api/get-account-balance', jwtCheck, async (req, res) => {
    if (req.jwtDecoded) {
      const jwtDecoded = req.jwtDecoded;
      const verifierId = jwtDecoded.payload.verifierId;
      const user = await db.getUser(verifierId);

      const balance = user.account_balance || 0;
      return res.send({ balance });
    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
  });

  app.post('/api/bank-deposit', jwtCheck, async (req, res) => {
    if (req.jwtDecoded) {
      const jwtDecoded = req.jwtDecoded;
      const verifierId = jwtDecoded.payload.verifierId;
      const user = await db.getUser(verifierId);

      const amount = +req.body.amount;

      if (user.bank_account && amount) {

        // do circle wire mock req
        try {
          await circle.createMockWire(user.id, amount);
        } catch(e) {
          console.error('/api/bank-deposits [circle.createMockWire]',e);
          return res.status(400).json({message: 'Bad Request'});
        }

        const type_ = 'bank_account';
        const account = user.bank_account;

        try {
          await db.addNewDeposit(user.id, amount, type_, account);
          await db.updateAccountBalance(user.id, amount, 'add');
          return res.status(200).send({message: 'ok'});
        } catch(e) {
          console.error('/api/bank-deposit [db.setOrUpdateAccounts]',e);
          return res.status(400).json({message: 'Bad Request'});
        }
      } else {
        return res.status(400).json({message: 'Bad Request'});
      }
    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
  });

  app.post('/api/onchain-deposit', jwtCheck, async (req, res) => {
    if (req.jwtDecoded) {
      const jwtDecoded = req.jwtDecoded;
      const verifierId = jwtDecoded.payload.verifierId;
      const user = await db.getUser(verifierId);

      const web3 = new Web3('https://sepolia.base.org');
      const receipt = await web3.eth.getTransactionReceipt(req.body.txHash);
      const isTransfer = receipt.logs[0].topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const isToBuckslinger = receipt.logs[0].topics[2] === '0x0000000000000000000000005d66f718284c98b7de7108af2e8b2a2d05ab6f26';
      const from = receipt.from;
      const to = receipt.to;
      const amount = +receipt.logs[0].data / 1e6;

      if (isToBuckslinger && isTransfer && to === '0x036cbd53842c5426634e7929541ec2318f3dcf7e') {
        const type_ = 'onchain';
        try {
          await db.addNewDeposit(user.id, amount, type_, from);
          await db.updateAccountBalance(user.id, amount, 'add');
          return res.status(200).send({message: 'ok'});
        } catch(e) {
          console.error('/api/bank-deposit [db.setOrUpdateAccounts]',e);
          return res.status(400).json({message: 'Bad Request'});
        }
      } else {
        return res.status(400).json({message: 'Bad Request'});
      }

    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
  });

  function isValidEthereumAddress(address) {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  }

  app.post('/api/send-payment', jwtCheck, async (req, res) => {
    if (req.jwtDecoded) {
      const jwtDecoded = req.jwtDecoded;
      const verifierId = jwtDecoded.payload.verifierId;
      const user = await db.getUser(verifierId);

      const balance = user.account_balance || 0;
      const to = req.body.to;
      const amount = req.body.amount;

      if (balance > amount) {
        const sendOnchain = isValidEthereumAddress(to);
        let toUser;

        if (!sendOnchain) {
          toUser = await db.getUserByUserName(to);
        }

        if (!sendOnchain && !toUser) {
          // else try to find basename?
          return res.status(400).json({message: 'Bad Request 1'});
        }

        try {
          if (toUser) {
            await db.updateAccountBalance(toUser.id, amount, 'add');
            await db.updateAccountBalance(user.id, amount, 'sub');
          }

          if (sendOnchain) {
            await db.updateAccountBalance(user.id, amount, 'sub');
            // await sendUsdcToAddress(); // Can't do this yet, Circle needs to approve every address
          }
          return res.status(200).send({message: 'ok'});
        } catch(e) {
          console.error('/api/bank-deposit [db.setOrUpdateAccounts]',e);
          return res.status(400).json({message: 'Bad Request 1'});
        }
      } else {
        return res.status(400).json({message: 'Bad Request 3'});
      }
    } else {
      return res.status(401).json({message: 'Unauthorized'});
    }
  });

  app.use(express.static('public', { extensions: ['html'] }));

  app.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
})().catch(console.error);