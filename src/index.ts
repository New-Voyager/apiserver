const TOKEN_SECRET =
  'd8e07f8bb0006f07ea15fb94e6a4db7c3957722b0e1aa63e7cf024a05628ba7f8f319d8960060f0ea5df48c5d8f2e583b8e0686aaffb7ef505945840919a5a2f';

export function getJwtSecret(): string {
  let secret = '';
  if (process.env['TOKEN_SECRET']) {
    secret = process.env['TOKEN_SECRET'];
  }
  if (!secret) {
    secret = TOKEN_SECRET;
  }
  return secret;
}
