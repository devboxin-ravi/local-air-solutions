import { createSignedToken, verifySignedToken } from '../src/utils/signedToken';

const SECRET = 'unit-test-signing-secret-0123456789-abcdef';
const PURPOSE = 'invoice-pdf';
const inOneDay = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

describe('signedToken', () => {
  it('returns the id for a valid, unexpired token', () => {
    const token = createSignedToken(PURPOSE, 31, inOneDay(), SECRET);
    expect(verifySignedToken(PURPOSE, token, SECRET)).toBe(31);
  });

  it('rejects a token whose id or expiry was changed', () => {
    const [id, exp, sig] = createSignedToken(PURPOSE, 31, inOneDay(), SECRET).split('.');
    expect(verifySignedToken(PURPOSE, `${Number(id) + 1}.${exp}.${sig}`, SECRET)).toBeNull();
    expect(verifySignedToken(PURPOSE, `${id}.${Number(exp) + 999}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects an expired token, a different purpose or secret, and garbage', () => {
    const expired = createSignedToken(PURPOSE, 31, new Date(Date.now() - 1000), SECRET);
    expect(verifySignedToken(PURPOSE, expired, SECRET)).toBeNull();
    const token = createSignedToken(PURPOSE, 31, inOneDay(), SECRET);
    expect(verifySignedToken('other-purpose', token, SECRET)).toBeNull();
    expect(verifySignedToken(PURPOSE, token, `${SECRET}-rotated`)).toBeNull();
    expect(verifySignedToken(PURPOSE, 'not-a-token', SECRET)).toBeNull();
  });
});
