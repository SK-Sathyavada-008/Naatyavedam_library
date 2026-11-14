import test from 'node:test';
import assert from 'node:assert/strict';

// Logic mirror of src/services/auth.ts for node:test runner
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const INTERNAL_DOMAIN = '@naatyavedam.com';

function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}${INTERNAL_DOMAIN}`;
}

function validateUsername(username) {
  const clean = username.toLowerCase().trim();
  if (!clean) return { isValid: false, error: 'Username is required.' };
  if (clean.length < 3) return { isValid: false, error: 'Username must be at least 3 characters long.' };
  if (clean.length > 20) return { isValid: false, error: 'Username cannot exceed 20 characters.' };
  if (!USERNAME_REGEX.test(clean)) {
    return {
      isValid: false,
      error: 'Username can only contain lowercase letters, numbers, and underscores.',
    };
  }
  return { isValid: true };
}

function validatePassword(password) {
  if (!password) return { isValid: false, error: 'Password is required.' };
  if (password.length < 6) return { isValid: false, error: 'Password must be at least 6 characters long.' };
  return { isValid: true };
}

function canPermanentlyDeleteSong(role) {
  return role === 'TEACHER';
}

function canAccessLibrary(status) {
  return status === 'APPROVED';
}

function isValidResetCode(code) {
  return typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code.trim().toUpperCase());
}

test('Auth: Username Validation - Valid usernames', () => {
  assert.equal(validateUsername('veda').isValid, true);
  assert.equal(validateUsername('ananya_dance').isValid, true);
  assert.equal(validateUsername('kuchipudi_007').isValid, true);
  assert.equal(validateUsername('priya_r').isValid, true);
});

test('Auth: Username Validation - Reject invalid lengths', () => {
  assert.equal(validateUsername('ab').isValid, false);
  assert.equal(validateUsername('').isValid, false);
  assert.equal(validateUsername('this_username_is_way_too_long_for_system').isValid, false);
});

test('Auth: Username Validation - Reject invalid characters', () => {
  assert.equal(validateUsername('ananya dance').isValid, false, 'reject spaces');
  assert.equal(validateUsername('ananya@dance').isValid, false, 'reject @');
  assert.equal(validateUsername('ananya-dance').isValid, false, 'reject hyphens');
  assert.equal(validateUsername('ananya.dance').isValid, false, 'reject dots');
  assert.equal(validateUsername('dance#1').isValid, false, 'reject symbols');
});

test('Auth: Password Validation', () => {
  assert.equal(validatePassword('naatyavedam').isValid, true);
  assert.equal(validatePassword('student123').isValid, true);
  assert.equal(validatePassword('12345').isValid, false, 'reject < 6 characters');
  assert.equal(validatePassword('').isValid, false, 'reject empty password');
});

test('Auth: usernameToEmail - Maps cleanly to internal domain', () => {
  assert.equal(usernameToEmail('veda'), 'veda@naatyavedam.com');
  assert.equal(usernameToEmail('Ananya_Dance '), 'ananya_dance@naatyavedam.com');
});

test('Auth: Role Permissions - Permanent song deletion strictly teacher only', () => {
  assert.equal(canPermanentlyDeleteSong('TEACHER'), true);
  assert.equal(canPermanentlyDeleteSong('STUDENT'), false);
});

test('Auth: Status Access - Only approved members get library access', () => {
  assert.equal(canAccessLibrary('APPROVED'), true);
  assert.equal(canAccessLibrary('PENDING'), false);
  assert.equal(canAccessLibrary('REJECTED'), false);
  assert.equal(canAccessLibrary('REMOVED'), false);
});

test('Auth: Password Reset Code Format - 6 uppercase alphanumeric characters', () => {
  assert.equal(isValidResetCode('7A4F2C'), true);
  assert.equal(isValidResetCode('NAATYA'), true);
  assert.equal(isValidResetCode('123456'), true);
  assert.equal(isValidResetCode('7a4f2c'), true, 'accepts case insensitively');
  assert.equal(isValidResetCode('7A4F2'), false, 'too short');
  assert.equal(isValidResetCode('7A4F2C8'), false, 'too long');
  assert.equal(isValidResetCode('7A-4F2'), false, 'special chars rejected');
});
