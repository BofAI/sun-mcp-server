// Minimal CommonJS stub for @scure/bip32

class HDKey {
  static fromMasterSeed(_seed) {
    return new HDKey();
  }

  derive(_path) {
    // Return an object with a dummy privateKey buffer
    return {
      privateKey: Buffer.alloc(32, 1),
    };
  }
}

module.exports = {
  HDKey,
};

