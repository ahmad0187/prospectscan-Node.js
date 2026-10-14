import { describe, expect, it } from 'vitest';
import { assertPublicHost, isPrivateAddress } from '../src/audit/netguard.js';

describe('SSRF guard', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.10', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1'])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '93.184.216.34', '2606:4700::1111'])('allows %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
  it('rejects localhost URLs', async () => {
    await expect(assertPublicHost('http://127.0.0.1:8080/')).rejects.toThrow(/not allowed/);
  });
});
