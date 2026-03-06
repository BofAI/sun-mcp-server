// Minimal CommonJS stub for @scure/bip39 used only in tests.
// It avoids pulling in the ESM implementation while keeping the API surface.

function validateMnemonic(_mnemonic) {
  return true;
}

function mnemonicToSeedSync(_mnemonic) {
  // 64-byte zero seed placeholder
  return Buffer.alloc(64, 0);
}

module.exports = {
  validateMnemonic,
  mnemonicToSeedSync,
};

