"use strict";

// Lightweight Jest stub for @scure/bip39 used in tests.
// It avoids pulling in the real crypto-heavy implementation while
// still exercising the wallet configuration logic at a high level.

function validateMnemonic(phrase) {
  if (typeof phrase !== "string") return false;
  const words = phrase.trim().split(/\s+/);
  // Treat 12+ words as "valid" for testing purposes only.
  return words.length >= 12;
}

function mnemonicToSeedSync(_mnemonic) {
  // Return a deterministic fake 32-byte buffer.
  return Buffer.alloc(32, 1);
}

module.exports = {
  validateMnemonic,
  mnemonicToSeedSync,
};

