export async function authorize(req, res, next) {
  if (req.headers.authorization) {
    const toks: string[] = req.headers.authorization.split(' ');
    if (toks[0] === 'Bearer') {
      req.playerId = toks[1];
    } else {
      // handle other service requests
    }
  }
  next();
}
