// Circle API functions

async function createMockWire(userId, amount) {
  const request = fetch('https://api-sandbox.circle.com/v1/mocks/payments/wire', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: 'Bearer SAND_API_KEY:' + process.env.CIRCLE_SAND_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      "amount": {
        "currency": "USD",
        amount
      },
      "beneficiaryBank": {
        "accountNumber": "99009132655"
      },
      "trackingRef": userId
    })
  });
}

async function sendUsdcToAddress(userId, amount) {
  //pass
}


module.exports = {
  createMockWire,
};