declare module '@bankofai/agent-wallet' {
  export interface BaseWallet {
    getAddress(): Promise<string>;
    signMessage(message: Buffer | string): Promise<string>;
    signTransaction(tx: Record<string, unknown>): Promise<string>;
  }

  export interface Eip712Capable {
    signTypedData(params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<string>;
  }

  export interface TronWallet extends BaseWallet {
    constructor(privateKey: Buffer): void;
  }

  export const TronWallet: {
    new (privateKey: Buffer): TronWallet & Eip712Capable;
  };

  export interface WalletListItem {
    id: string;
    type: string;
  }

  export interface LocalWalletProvider {
    getActive(): Promise<BaseWallet>;
    getWallet(id: string): Promise<BaseWallet>;
    setActive(id: string): void;
    getActiveId(): string | null;
    listWallets(): Promise<WalletListItem[]>;
  }

  export class SecureKVStore {
    constructor(secretsDir: string, password: string);
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    generateKey(id: string): Buffer;
  }

  export interface WalletConfig {
    wallets: Record<string, unknown>;
    activeWalletId?: string;
  }

  export function WalletFactory(options: { secretsDir: string; password: string }): LocalWalletProvider;
  export function loadConfig(secretsDir: string): WalletConfig;
  export function saveConfig(secretsDir: string, config: WalletConfig): void;
}
