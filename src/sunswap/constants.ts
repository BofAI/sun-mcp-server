export interface NetworkConstants {
  trx: string
}

export interface SwapConstants extends NetworkConstants {
  universalRouter: string
  permit2: string
  routerApiUrl: string
}

export const MAINNET: SwapConstants = {
  universalRouter: 'TSJEtPuqHpvSaVnSwvCsngaeBxrGUzp95Q',
  permit2: 'TTJxU3P8rHycAyFY4kVtGNfmnMH4ezcuM9',
  routerApiUrl: 'https://rot.endjgfsv.link',
  trx: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
}

export const NILE: SwapConstants = {
  universalRouter: 'TEgq4237arNE7jX74KCDkc1MXdZeWNkGVj',
  permit2: 'TYQuuhGbEMxF7nZxUHV3uHJxAVVAegNU9h',
  routerApiUrl: 'https://tnrouter.endjgfsv.link',
  trx: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
}

export const SHASTA: NetworkConstants = {
  trx: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
}
