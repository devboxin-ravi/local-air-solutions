import { decryptSecret, encryptSecret } from '../src/utils/secretBox';

const KEY = 'unit-test-master-key-0123456789-abcdefgh';

describe('secretBox', () => {
  it('round-trips a secret and never stores it in plain text', () => {
    const sealed = encryptSecret('rzp_secret_value', KEY);
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(sealed).not.toContain('rzp_secret_value');
    expect(decryptSecret(sealed, KEY)).toBe('rzp_secret_value');
  });

  it('uses a fresh IV, so the same secret encrypts differently each time', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
  });

  it('rejects a wrong master key or tampered data', () => {
    const sealed = encryptSecret('secret', KEY);
    expect(() => decryptSecret(sealed, 'another-master-key-0123456789-abcdefgh')).toThrow();
    const parts = sealed.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptSecret(parts.join(':'), KEY)).toThrow();
  });
});
