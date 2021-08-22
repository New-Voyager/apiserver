export async function createPromotion(req: any, resp: any) {
  console.log('Enter: function createPromotion');

  const name = req.body['name'];
  const code = req.body['code'];
  const expiresAt = req.body['expires-at'];
  const coins = req.body['coins'];

  const errors = new Array<string>();
  if (!name) {
    errors.push('promotion name field is required');
  }
  if (!code) {
    errors.push('promotion code is required');
  }
  if (!expiresAt) {
    errors.push('promotion expires-at date is required');
  }
  if (!coins) {
    errors.push('promotion coins is required');
  }

  if (errors.length >= 1) {
    resp.status(400).send(JSON.stringify({errors: errors}));
  }
  resp.status(200).send({name, code, 'expires-at': expiresAt, coins});
}
