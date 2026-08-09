const allProducts = [
  {
    slug: 'gembapay',
    name: 'GembaPay',
    status: 'developer-preview',
    statusNote: 'test networks only',
    featured: true,
    order: 1,
    category: 'payments',
    audience: ['merchants', 'e-commerce', 'SaaS businesses', 'developers'],
    appUrl: 'https://gembapay.com',
    appLabel: 'Visit gembapay.com',
    githubUrl: null,
    githubNote: null,
    tech: ['Node.js', 'Express', 'React', 'PostgreSQL', 'Prisma', 'Stripe Connect', 'PayPal'],
    networks: [],
    contracts: [],
    metrics: [],
    tags: ['Stripe', 'PayPal', '86+ currencies'],
    partners: [
      { name: 'Stripe', type: 'payment' },
      { name: 'PayPal', type: 'payment' },
      { name: 'WooCommerce', type: 'ecosystem' },
      { name: 'OpenZeppelin', type: 'security' }
    ],
    certifications: [
      { label: 'Payment partners', result: 'Stripe Connect platform and PayPal PPCP integration' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembapay'
  },
  {
    slug: 'gembaticket',
    name: 'GembaTicket',
    status: 'testnet',
    statusNote: 'on GembaBlockchain Testnet',
    featured: true,
    order: 3,
    category: 'web3',
    audience: ['event organizers', 'venues', 'ticketing platforms'],
    appUrl: 'https://gembaticket.com',
    appLabel: 'Visit GembaTicket',
    githubUrl: null,
    githubNote: null,
    tech: ['Solidity 0.8.28', 'Hardhat', 'OpenZeppelin v5', 'ERC721', 'ERC1155', 'EIP-1167', 'Node.js', 'Express', 'PostgreSQL', 'Redis', 'IPFS', 'React', 'Tailwind'],
    networks: [
      { name: 'GembaBlockchain', chainId: 821207, ready: ['GembaBlockchain'] }
    ],
    contracts: [],
    // Live, auto-updating stats from the GembaTicket public API (see ProductDetail).
    statsUrl: 'https://api.gembaticket.com/api/stats',
    metrics: [
      { statKey: 'events', value: '—', label: 'Total events' },
      { statKey: 'ticketsSold', value: '—', label: 'Tickets sold' },
      { statKey: 'revenue', prefix: '€', value: '—', label: 'Revenue' }
    ],
    tags: ['Ticketing', 'NFT', 'GembaBlockchain', '0 fees', 'Invisible blockchain', 'GembaPay', 'Privacy-first', 'QR rotation'],
    partners: [
      { name: 'GembaPay', type: 'payments', url: 'https://gembapay.com' },
      { name: 'OpenZeppelin', type: 'security', url: 'https://openzeppelin.com' },
      { name: 'GembaBlockchain', type: 'blockchain', url: 'https://gembachain.io' },
      { name: 'IPFS / Pinata', type: 'storage', url: 'https://ipfs.tech' }
    ],
    certifications: [
      { label: 'Slither + Mythril audit', result: 'Completed on v2 contracts, no critical findings' },
      { label: 'Zero custody', result: 'No private keys stored for users, no escrow balance held' }
    ],
    caseStudy: { hasWhatWeAre: false, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembaticket'
  },
  {
    slug: 'educhain',
    name: 'EduChain',
    status: 'testnet',
    statusNote: 'testnet only — no real funds',
    featured: true,
    order: 7,
    category: 'education',
    audience: ['schools', 'teachers', 'students', 'EU educational institutions'],
    appUrl: 'https://educhain.gembait.com',
    appLabel: 'Visit Educhain Dapp',
    githubUrl: 'https://github.com/ivanovslavy/EduChain',
    githubNote: 'Smart contracts (frontend private)',
    tech: ['Solidity 0.8.28', 'OpenZeppelin v5', 'Hardhat', 'React 19', 'ethers v6', 'wagmi', 'viem', 'IPFS', 'Pinata'],
    networks: [
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: [] }
    ],
    contracts: [
      { label: 'Whitelist', address: '0x1e7D76fE34584df2d2029E5304AB575D79Dc8108', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0x1e7D76fE34584df2d2029E5304AB575D79Dc8108' },
      { label: 'GameToken (ERC20)', address: '0xe778ee7559907961F24B6F3C31E9792199EC608D', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0xe778ee7559907961F24B6F3C31E9792199EC608D' },
      { label: 'GameNFTPredefined', address: '0x1113D032460A55Fb91808BD07566397502185012', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0x1113D032460A55Fb91808BD07566397502185012' },
      { label: 'GameNFTCustom', address: '0xba17A76635B4069BF8ca9E3516225a6A1a6e15a3', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0xba17A76635B4069BF8ca9E3516225a6A1a6e15a3' },
      { label: 'TokenMarketplace', address: '0xF61647866ad7be8137230Ad688092D2f3F4A1666', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0xF61647866ad7be8137230Ad688092D2f3F4A1666' },
      { label: 'TrackingContract', address: '0xc9af98AD8ae78086620821F9Ceb05842Dd7950CF', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0xc9af98AD8ae78086620821F9Ceb05842Dd7950CF' },
      { label: 'ETHFaucet', address: '0x7Ff43282d7939418a3f0A308E2d48Dd93536044e', chain: 'GembaBlockchain', explorerUrl: 'https://testnet.gembascan.io/address/0x7Ff43282d7939418a3f0A308E2d48Dd93536044e' }
    ],
    metrics: [
      { value: '4', label: 'Participants' },
      { value: '32', label: 'NFTs created' }
    ],
    tags: ['Education', 'Web3', 'EU', 'Teacher training', 'Sandbox', 'GDPR', 'GembaBlockchain'],
    partners: [
      { name: 'GembaBlockchain', type: 'blockchain' },
      { name: 'Pinata', type: 'storage' },
      { name: 'OpenZeppelin', type: 'security' }
    ],
    certifications: [],
    caseStudy: { hasWhatWeAre: true, hasSecurity: false, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'educhain'
  },
  {
    slug: 'permitiv',
    name: 'Permitiv — foundation of project Atlas',
    status: 'in-development',
    featured: false,
    order: 6,
    category: 'saas',
    audience: ['industrial companies', 'refinery operators', 'workforce managers'],
    appUrl: 'https://permitiv.com',
    appLabel: 'Visit permitiv.com',
    githubUrl: null,
    githubNote: null,
    tech: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'AI assistant'],
    networks: [],
    contracts: [],
    metrics: [],
    tags: ['SaaS', 'Modular', 'Industrial', 'Docker', 'Self-host'],
    partners: [],
    certifications: [],
    caseStudy: { hasWhatWeAre: false, hasSecurity: false, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'permitiv'
  },
  {
    slug: 'gembablockchain',
    name: 'GembaBlockchain',
    status: 'testnet',
    statusNote: 'testnet only — no mainnet',
    featured: true,
    order: 2,
    category: 'web3',
    audience: ['public institutions', 'municipalities', 'organizations', 'validators', 'developers'],
    appUrl: 'https://gembachain.io',
    appLabel: 'Visit gembachain.io',
    githubUrl: 'https://github.com/ivanovslavy/GembaBlockchain',
    githubNote: null,
    tech: ['Cosmos SDK', 'Cosmos EVM', 'CometBFT', 'Go', 'Solidity', 'EVM', 'Blockscout'],
    networks: [
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: [] }
    ],
    contracts: [],
    metrics: [
      { value: '0%', label: 'Inflation' },
      { value: '821207', label: 'EVM chainId' },
      { value: '4', label: 'Validators live' }
    ],
    tags: ['Cosmos SDK', 'EVM', 'Proof-of-Stake', 'Permissionless', 'Zero inflation', 'GMB', 'CometBFT'],
    partners: [
      { name: 'Cosmos EVM', type: 'framework' },
      { name: 'CometBFT', type: 'consensus' },
      { name: 'Blockscout', type: 'explorer' },
      { name: 'OpenZeppelin', type: 'security' }
    ],
    certifications: [
      { label: 'Consensus', result: 'CometBFT BFT Proof-of-Stake, instant finality, no reorgs' },
      { label: 'Supply', result: 'Fixed 100M GMB, 0% inflation — mint module disabled' },
      { label: 'EVM', result: 'Full EVM compatibility (MetaMask, Foundry, ethers), chainId 821207' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembablockchain'
  },
  {
    slug: 'gembapass',
    name: 'GembaPass',
    status: 'testnet',
    statusNote: 'on GembaBlockchain Testnet',
    featured: true,
    order: 4,
    category: 'web3',
    audience: ['companies', 'public institutions', 'HR & facilities', 'employees'],
    appUrl: 'https://gembapass.com',
    appLabel: 'Visit gembapass.com',
    githubUrl: null,
    githubNote: 'Private repository',
    tech: ['Solidity 0.8.24', 'Foundry', 'OpenZeppelin v5', 'ERC-1155', 'Node.js', 'Express', 'Prisma', 'PostgreSQL', 'Redis', 'IPFS', 'React', 'Vite', 'ethers v6'],
    networks: [
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: [] }
    ],
    contracts: [
      { label: 'GembaAccessPass', address: '0x1B72b95588B75925B59715d582504C9D42594899', chain: 'GembaBlockchain Testnet', explorerUrl: 'https://testnet.gembascan.io/address/0x1B72b95588B75925B59715d582504C9D42594899' }
    ],
    metrics: [
      { value: '1-click', label: 'Issue / revoke' },
      { value: '0', label: 'Wallets for staff' },
      { value: 'Soulbound', label: 'Access NFT' },
      { value: 'Multi-tenant', label: 'Cloud + on-prem' }
    ],
    tags: ['Access control', 'Managed credentials', 'Invisible infrastructure', 'GDPR', 'Subscription', 'Testnet'],
    partners: [
      { name: 'GembaBlockchain', type: 'blockchain' },
      { name: 'GembaPay', type: 'payments' },
      { name: 'IPFS', type: 'storage' },
      { name: 'OpenZeppelin', type: 'security' }
    ],
    certifications: [
      { label: 'Soulbound', result: 'Non-transferable; issuer-only mint and force-burn' },
      { label: 'No PII on-chain', result: 'Identity & logs off-chain (PostgreSQL RLS), GDPR-erasable' },
      { label: 'Source code', result: 'GembaAccessPass verified on GembaScan' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembapass'
  },
  {
    slug: 'gembarecords',
    name: 'GEMBA RECORDS Radio',
    status: 'live',
    statusNote: 'in production',
    featured: true,
    order: 14,
    category: 'saas',
    audience: ['the GembaIT team', 'music lovers', 'anyone who wants a good-mood soundtrack at work'],
    appUrl: 'https://radio.gembarecords.com',
    appLabel: 'Listen live',
    githubUrl: null,
    githubNote: null,
    // Extra hero CTAs beyond the live app + GitHub (download / store links).
    extraLinks: [
      { label: 'Download for Android (APK)', url: '/downloads/GembaRadio.apk', external: false, download: true },
      { label: 'Download for Android TV (APK)', url: '/downloads/GembaRadioTV.apk', external: false, download: true }
    ],
    tech: ['React', 'Vite', 'HLS / hls.js', 'PWA', 'Capacitor (Android)', 'AzuraCast', 'Apache', 'Cloudflare'],
    networks: [],
    contracts: [],
    metrics: [
      { value: '3', label: 'Live stations' },
      { value: '24/7', label: 'Always on' },
      { value: 'Free', label: 'No account, no ads' },
      { value: 'PWA', label: 'Installable in-browser' }
    ],
    tags: ['Radio', 'Live', 'Free', '24/7', 'Electronic', 'Hip-Hop', 'Classic', 'PWA', 'Android'],
    partners: [
      { name: 'AzuraCast', type: 'streaming' },
      { name: 'Cloudflare', type: 'cdn' },
      { name: 'GembaIT', type: 'maker', url: 'https://gembait.com' }
    ],
    certifications: [],
    caseStudy: { hasWhatWeAre: true, hasSecurity: false, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembarecords'
  },
  {
    slug: 'gembakitchen',
    name: 'GembaKitchen',
    status: 'live',
    statusNote: 'in production',
    featured: true,
    order: 5,
    category: 'saas',
    audience: ['restaurants', 'professional kitchens', 'cafés', 'catering businesses', 'home cooks'],
    appUrl: 'https://gembakitchen.com',
    appLabel: 'Visit gembakitchen.com',
    githubUrl: null,
    githubNote: 'Private repository',
    tech: ['Node.js', 'Express', 'Prisma', 'PostgreSQL', 'React', 'Vite', 'Claude AI', 'ElevenLabs', 'GembaPay'],
    networks: [],
    contracts: [],
    metrics: [
      { value: 'AI', label: 'Voice assistant (EN/BG)' },
      { value: '64+', label: 'Cookbook recipes' },
      { value: 'Multi-tenant', label: 'Isolated per kitchen' },
      { value: '72h', label: 'Free trial' }
    ],
    tags: ['SaaS', 'AI assistant', 'Voice', 'Inventory', 'Recipes', 'Food-cost', 'Multi-tenant', 'GembaPay'],
    partners: [
      { name: 'Claude (Anthropic)', type: 'ai' },
      { name: 'ElevenLabs', type: 'voice' },
      { name: 'GembaPay', type: 'payments', url: 'https://gembapay.com' },
      { name: 'PostgreSQL', type: 'database' }
    ],
    certifications: [
      { label: 'Tenant isolation', result: 'Per-restaurant data separation in a dedicated database' },
      { label: 'AI assistant', result: 'Claude function-calling over your own kitchen data; voice in EN + BG' },
      { label: 'Billing', result: 'GembaPay subscriptions — 72h free trial, no card data stored' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembakitchen'
  }
];

// [crypto-blackout 2026-08-09]
// Продуктите с `hidden: true` остават в този файл, в git и във всички преводи.
// Те просто не се сервират: няма карта, няма страница, няма запис в sitemap, няма OG.
// Връщат се с махане на един флаг.
export const products = allProducts.filter(p => !p.hidden);
export { allProducts };

export const getProductBySlug = (slug) => products.find(p => p.slug === slug);
export const getFeaturedProducts = () => products.filter(p => p.featured).sort((a, b) => a.order - b.order);
export const getProductsByCategory = (category, excludeSlug) =>
  products.filter(p => p.category === category && p.slug !== excludeSlug).sort((a, b) => a.order - b.order);
