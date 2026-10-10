const { hash, verify, Algorithm } = require('@node-rs/argon2');
const bcrypt = require('bcryptjs');

/**
 * Hashes a plaintext password using Argon2id
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  return await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1
  });
}

/**
 * Verifies a plaintext password against an Argon2id or legacy bcrypt hash
 */
async function verifyPassword(password, hashValue) {
  if (!password || !hashValue) return false;

  try {
    // If hash starts with $argon2, verify using Argon2id
    if (hashValue.startsWith('$argon2')) {
      return await verify(hashValue, password);
    }

    // Legacy fallback for bcrypt hashes (e.g. initial demo database seed)
    if (hashValue.startsWith('$2a$') || hashValue.startsWith('$2b$')) {
      return await bcrypt.compare(password, hashValue);
    }

    return false;
  } catch (err) {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
