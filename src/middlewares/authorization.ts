export async function authorize(req, res, next) {
  if (req.headers.authorization) {
    const toks: string[] = req.headers.authorization.split(' ');
    if (toks[0] === 'Bearer') {
      // set the context of the current user who is making this call
      req.playerId = toks[1];
    } else {
      // handle other service requests
    }
  }
  next();
}
