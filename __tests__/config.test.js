import { PRIVACY_POLICY_URL } from '../constants/config';

describe('config', () => {
  test('PRIVACY_POLICY_URL has a production default', () => {
    expect(PRIVACY_POLICY_URL).toMatch(/^https:\/\//);
    expect(PRIVACY_POLICY_URL).toContain('privacy');
  });
});
