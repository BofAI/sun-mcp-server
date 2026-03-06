"use strict";

// Lightweight Jest stub for @scure/bip32.
// Provides just enough behavior for the wallet HD derivation code
// to execute without relying on real cryptography.

class HDKey {
  constructor(privateKey) {
    this.privateKey = privateKey || Buffer.alloc(32, 2);
  }

  static fromMasterSeed(seed) {
    if (!seed) {
      return new HDKey();
    }
    const buf = Buffer.isBuffer(seed) ? seed : Buffer.from(seed);
    // Use first 32 bytes as a fake private key.
    return new HDKey(buf.subarray(0, 32));
  }

  derive(_path) {
    // Return a child with the same private key for testing.
    return new HDKey(this.privateKey);
  }
}

module.exports = {
  HDKey,
};

