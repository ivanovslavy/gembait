export const products = [
  {
    slug: 'gembapay',
    name: 'GembaPay',
    status: 'live',
    statusNote: 'in production',
    featured: true,
    order: 1,
    category: 'payments',
    audience: ['merchants', 'e-commerce', 'SaaS businesses', 'developers'],
    appUrl: 'https://gembapay.com',
    appLabel: 'Visit gembapay.com',
    githubUrl: null,
    githubNote: null,
    tech: ['Solidity', 'Node.js', 'Express', 'React', 'PostgreSQL', 'Prisma', 'Chainlink', 'Stripe Connect', 'PayPal'],
    networks: [
      { name: 'Ethereum Mainnet', chainId: 1, ready: ['Ethereum', 'BSC', 'Polygon'] },
      { name: 'BNB Smart Chain', chainId: 56, ready: [] },
      { name: 'Polygon', chainId: 137, ready: [] }
    ],
    contracts: [
      { label: 'PaymentGateway', address: '0xD9c4169061B92970b86afBF32dad4Ecfd749179e', chain: 'Ethereum', explorerUrl: 'https://etherscan.io/address/0xD9c4169061B92970b86afBF32dad4Ecfd749179e' },
      { label: 'PaymentGateway', address: '0xeE3d1CbD3cAF2D9194CbfC5B1bE8fdD5c3953eE1', chain: 'BSC', explorerUrl: 'https://bscscan.com/address/0xeE3d1CbD3cAF2D9194CbfC5B1bE8fdD5c3953eE1' },
      { label: 'PaymentGateway', address: '0x7cceCb66E7Fa6255244035533E31791bD1Fff254', chain: 'Polygon', explorerUrl: 'https://polygonscan.com/address/0x7cceCb66E7Fa6255244035533E31791bD1Fff254' },
      { label: 'GiftNFT', address: '0xD24a89dc1686C2F88d33A70250473495459C564a', chain: 'Ethereum', explorerUrl: 'https://etherscan.io/address/0xD24a89dc1686C2F88d33A70250473495459C564a' },
      { label: 'GiftNFT', address: '0x8Fee75865E8D87cdB844Ef5676D2D6456262BA7A', chain: 'BSC', explorerUrl: 'https://bscscan.com/address/0x8Fee75865E8D87cdB844Ef5676D2D6456262BA7A' },
      { label: 'GiftNFT', address: '0xD24a89dc1686C2F88d33A70250473495459C564a', chain: 'Polygon', explorerUrl: 'https://polygonscan.com/address/0xD24a89dc1686C2F88d33A70250473495459C564a' }
    ],
    metrics: [
      { value: '5', label: 'Active merchants' },
      { value: '256', label: 'Transactions processed' },
      { value: '$1,118', label: 'Volume processed' },
      { value: '3', label: 'Networks live' }
    ],
    tags: ['Non-custodial', 'Stripe', 'PayPal', 'Ethereum', 'BSC', 'Polygon', '86+ currencies'],
    partners: [
      { name: 'Stripe', type: 'payment' },
      { name: 'PayPal', type: 'payment' },
      { name: 'Chainlink', type: 'oracle' },
      { name: 'WooCommerce', type: 'ecosystem' },
      { name: 'OpenZeppelin', type: 'security' }
    ],
    certifications: [
      { label: 'Slither static analysis', result: 'Zero high-severity findings' },
      { label: 'Access control', result: 'OpenZeppelin Ownable + ReentrancyGuard' },
      { label: 'Source code', result: 'Verified on Etherscan, BSCScan, PolygonScan' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembapay'
  },
  {
    slug: 'gembatools',
    name: 'GembaTools',
    status: 'testnet',
    statusNote: 'on Sepolia',
    featured: true,
    order: 11,
    category: 'web3',
    audience: ['token creators', 'NFT projects', 'DeFi teams', 'developers'],
    appUrl: 'https://gembatools.io',
    appLabel: 'Launch app',
    githubUrl: 'https://github.com/ivanovslavy/GembaTools',
    githubNote: null,
    tech: ['Solidity 0.8.27', 'Hardhat', 'OpenZeppelin v5', 'ERC721A', 'React', 'Vite', 'wagmi', 'viem', 'Uniswap V3'],
    networks: [
      { name: 'Ethereum Sepolia', chainId: 11155111, ready: ['Ethereum', 'BSC', 'Polygon', 'Base'] }
    ],
    contracts: [
      { label: 'GembaERC20Factory', address: '0xF3aB51315BbC26ea4e3a509d5bE139d1246a999E', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0xF3aB51315BbC26ea4e3a509d5bE139d1246a999E' },
      { label: 'GembaERC20TaxFactory', address: '0x722191FBef1960fa4e23771946D94A2051D5f2Ae', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0x722191FBef1960fa4e23771946D94A2051D5f2Ae' },
      { label: 'GembaERC20AdvancedFactory', address: '0x8D821d2440Be64D7de39188Aac4Af769F2538e4C', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0x8D821d2440Be64D7de39188Aac4Af769F2538e4C' },
      { label: 'GembaERC721Factory', address: '0xcC95A4A33C4b7e769CfB6841Ec92B922266Df26E', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0xcC95A4A33C4b7e769CfB6841Ec92B922266Df26E' },
      { label: 'GembaERC721AFactory', address: '0xe6acD89ac14667c95878A71F44c4233Dd0bEcf5f', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0xe6acD89ac14667c95878A71F44c4233Dd0bEcf5f' },
      { label: 'GembaERC1155Factory', address: '0xFA99A9EBc5b180f6538cD4959f8d9Fb20C26E4f0', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0xFA99A9EBc5b180f6538cD4959f8d9Fb20C26E4f0' },
      { label: 'GembaSwapRouter', address: '0x8405CEB8212a9e725162C78aBF5Adebab5820387', chain: 'Sepolia', explorerUrl: 'https://sepolia.etherscan.io/address/0x8405CEB8212a9e725162C78aBF5Adebab5820387' }
    ],
    metrics: [
      { value: '22', label: 'Tokens deployed' },
      { value: '7', label: 'Active LP positions' },
      { value: '5', label: 'Unique wallets' },
      { value: '6', label: 'Contract types' }
    ],
    tags: ['Token factory', 'DEX', 'Presale', 'NFT', 'Uniswap V3', 'No-code'],
    partners: [
      { name: 'Uniswap V3', type: 'dex' },
      { name: 'OpenZeppelin', type: 'security' },
      { name: 'Azuki ERC721A', type: 'standard' },
      { name: 'wagmi / viem', type: 'tooling' }
    ],
    certifications: [
      { label: 'Slither static analysis', result: 'Zero high-severity findings across all factories' },
      { label: 'Contract architecture', result: 'No proxies, no delegatecall, no admin backdoors' },
      { label: 'Source code', result: 'All 7 factories verified on Sepolia Etherscan' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembatools'
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
    tags: ['Ticketing', 'NFT', 'GembaBlockchain', '0 fees', 'Invisible blockchain', 'GembaPay', 'Non-custodial', 'QR rotation'],
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
    status: 'live',
    statusNote: 'on GembaBlockchain Testnet',
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
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: ['Mainnet'] }
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
    name: 'Permitiv',
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
    slug: 'kotkata',
    name: 'Kotkata',
    status: 'live',
    statusNote: 'in production',
    featured: false,
    order: 12,
    category: 'nft',
    audience: ['GembaPay customers', 'NFT collectors'],
    appUrl: 'https://gembapay.com/nft-gift',
    appLabel: 'View collection',
    githubUrl: 'https://github.com/ivanovslavy/kotkata-nft',
    githubNote: null,
    tech: ['Solidity 0.8.27', 'ERC721A', 'ERC2981', 'OpenZeppelin', 'Node.js', 'Sharp', 'IPFS', 'Filebase'],
    networks: [
      { name: 'Ethereum', chainId: 1, ready: [] },
      { name: 'BNB Smart Chain', chainId: 56, ready: [] },
      { name: 'Polygon', chainId: 137, ready: [] }
    ],
    contracts: [
      { label: 'Kotkata', address: '0xD24a89dc1686C2F88d33A70250473495459C564a', chain: 'Ethereum', explorerUrl: 'https://etherscan.io/address/0xD24a89dc1686C2F88d33A70250473495459C564a' },
      { label: 'Kotkata', address: '0x8Fee75865E8D87cdB844Ef5676D2D6456262BA7A', chain: 'BSC', explorerUrl: 'https://bscscan.com/address/0x8Fee75865E8D87cdB844Ef5676D2D6456262BA7A' },
      { label: 'Kotkata', address: '0xD24a89dc1686C2F88d33A70250473495459C564a', chain: 'Polygon', explorerUrl: 'https://polygonscan.com/address/0xD24a89dc1686C2F88d33A70250473495459C564a' }
    ],
    metrics: [
      { value: '113', label: 'Total minted' },
      { value: '12', label: 'Holders' },
      { value: '3', label: 'Networks' },
      { value: '$0.001', label: 'Gas on Polygon' }
    ],
    tags: ['NFT', 'ERC721A', 'Gift', 'Multi-chain', 'Hand-drawn'],
    partners: [
      { name: 'GembaPay', type: 'distribution' },
      { name: 'Filebase', type: 'storage' },
      { name: 'OpenZeppelin', type: 'security' }
    ],
    certifications: [
      { label: 'Slither + Solhint', result: 'Zero vulnerabilities' },
      { label: 'Test coverage', result: '33 tests passing' },
      { label: 'Source code', result: 'Verified on Etherscan, BSCScan, PolygonScan' }
    ],
    caseStudy: { hasWhatWeAre: false, hasSecurity: false, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'kotkata'
  },
  {
    slug: 'gembaescrow',
    name: 'Gemba Escrow',
    status: 'testnet',
    statusNote: 'on GembaBlockchain Testnet',
    featured: false,
    order: 9,
    category: 'web3',
    audience: ['real estate agents', 'notaries', 'buyers and sellers', 'high-value asset traders'],
    appUrl: 'https://escrow.gembait.com',
    appLabel: 'Visit Escrow Dapp',
    githubUrl: null,
    githubNote: null,
    tech: ['Solidity 0.8.20', 'OpenZeppelin', 'Hardhat', 'Clone factory', 'React 18', 'ethers.js v6', 'IPFS'],
    networks: [
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: ['GembaBlockchain Mainnet'] }
    ],
    contracts: [],
    metrics: [
      { value: '5', label: 'Contracts deployed' },
      { value: '121 GMB', label: 'Total settled' }
    ],
    tags: ['Escrow', 'Real estate', 'Multi-party', 'IPFS', 'Clone factory'],
    partners: [
      { name: 'OpenZeppelin', type: 'security' },
      { name: 'IPFS', type: 'storage' }
    ],
    certifications: [
      { label: 'Slither audit', result: 'Zero high/medium findings; 2 low accepted by design' },
      { label: 'Fee cap', result: 'Hard-coded 20% maximum across notary + agent' }
    ],
    caseStudy: { hasWhatWeAre: false, hasSecurity: false, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembaescrow'
  },
  {
    slug: 'gembawin',
    name: 'GembaWin',
    status: 'testnet',
    statusNote: 'on GembaBlockchain Testnet',
    featured: false,
    order: 10,
    category: 'web3',
    audience: ['contest organizers', 'hackathon hosts', 'bounty programs'],
    appUrl: 'https://win.gembait.com',
    appLabel: 'Visit GembaWin',
    githubUrl: 'https://github.com/ivanovslavy/gembawin',
    githubNote: null,
    tech: ['Solidity', 'Hardhat', 'OpenZeppelin', 'ReentrancyGuard', 'SafeERC20'],
    networks: [
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: ['Ethereum', 'BSC', 'Polygon'] }
    ],
    contracts: [],
    metrics: [],
    tags: ['Bounty', 'Contests', 'GMB', 'USDT', 'USDC', 'Time-locked'],
    partners: [
      { name: 'OpenZeppelin', type: 'security' },
      { name: 'SafeERC20', type: 'standard' }
    ],
    certifications: [
      { label: 'Slither audit', result: 'Clean audit results' },
      { label: 'Claim window', result: 'Enforced 30-day on-chain claim period' }
    ],
    caseStudy: { hasWhatWeAre: false, hasSecurity: false, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembawin'
  },
  {
    slug: 'nftviewer',
    name: 'NFT Viewer',
    status: 'live',
    statusNote: 'in production',
    featured: false,
    order: 8,
    category: 'web3',
    audience: ['NFT collectors', 'ticket holders', 'developers'],
    appUrl: 'https://nftviewer.gembait.com/',
    appLabel: 'Open viewer',
    githubUrl: null,
    githubNote: null,
    tech: ['React 18', 'Vite 6', 'Node.js', 'Express', 'ethers.js v6', 'Moralis SDK v2', 'IPFS'],
    networks: [
      { name: 'Ethereum', chainId: 1, ready: [] },
      { name: 'Sepolia', chainId: 11155111, ready: [] },
      { name: 'Polygon', chainId: 137, ready: [] },
      { name: 'BNB Smart Chain', chainId: 56, ready: [] }
    ],
    contracts: [],
    metrics: [],
    tags: ['Gallery', 'Moralis', 'IPFS', 'Multi-chain', 'Interactive NFTs'],
    partners: [
      { name: 'Moralis', type: 'indexer' },
      { name: 'IPFS', type: 'storage' }
    ],
    certifications: [],
    caseStudy: { hasWhatWeAre: false, hasSecurity: false, hasArchitecture: false, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'nftviewer'
  },
  {
    slug: 'gembasniper',
    name: 'Gemba Sniper Bot',
    status: 'live',
    statusNote: 'in production',
    featured: true,
    order: 13,
    category: 'web3',
    audience: ['DeFi traders', 'crypto-native developers', 'honeypot researchers', 'red-teamers'],
    appUrl: 'https://gembabots.com',
    appLabel: 'Visit gembabots.com',
    githubUrl: 'https://github.com/ivanovslavy/gemba-sniper-bot',
    githubNote: null,
    tech: ['Node.js (ESM)', 'Express', 'viem', 'ethers', 'React 18', 'Vite 5', 'PostgreSQL', 'Uniswap V3', 'Uniswap V4', 'Hardhat', 'Foundry', 'systemd'],
    networks: [
      { name: 'Ethereum Mainnet', chainId: 1, ready: [] },
      { name: 'Base Mainnet', chainId: 8453, ready: [] },
      { name: 'Ethereum Sepolia', chainId: 11155111, ready: [] }
    ],
    contracts: [],
    metrics: [
      { value: '10', label: 'Honeypot pipeline stages' },
      { value: '$0.03', label: 'Real sellability micro-test' },
      { value: '3', label: 'Networks supported' },
      { value: '100%', label: 'Non-custodial' }
    ],
    tags: ['Non-custodial', 'Sniper', 'Uniswap V3', 'Uniswap V4', 'Honeypot-aware', 'Open source', 'Ethereum', 'Base', 'Sepolia'],
    partners: [
      { name: 'Uniswap V3', type: 'dex' },
      { name: 'Uniswap V4', type: 'dex' },
      { name: 'GembaPay', type: 'payments' },
      { name: 'Cloudflare Turnstile', type: 'security' },
      { name: 'Telegram', type: 'notifications' }
    ],
    certifications: [
      { label: 'Custody model', result: 'Non-custodial — private key AES-256 encrypted client-side; server stores ciphertext only' },
      { label: 'Source code', result: 'Pipeline open source on GitHub' },
      { label: 'Red-team rig', result: 'Foundry test-hook-sepolia honeypot hooks validate the defenses in-house' }
    ],
    caseStudy: { hasWhatWeAre: true, hasSecurity: true, hasArchitecture: true, hasUseCases: true, hasFeatures: true, hasProblem: true, hasSolution: true },
    screenshots: [],
    i18nKey: 'gembasniper'
  },
  {
    slug: 'gembablockchain',
    name: 'GembaBlockchain',
    status: 'testnet',
    statusNote: null,
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
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: ['Mainnet'] }
    ],
    contracts: [],
    metrics: [
      { value: '100M', label: 'Fixed GMB supply' },
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
      { name: 'GembaBlockchain Testnet', chainId: 821207, ready: ['Mainnet'] }
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
    tags: ['Access control', 'Soulbound NFT', 'Custodial', 'Invisible blockchain', 'GDPR', 'Subscription', 'GembaBlockchain'],
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

export const getProductBySlug = (slug) => products.find(p => p.slug === slug);
export const getFeaturedProducts = () => products.filter(p => p.featured).sort((a, b) => a.order - b.order);
export const getProductsByCategory = (category, excludeSlug) =>
  products.filter(p => p.category === category && p.slug !== excludeSlug).sort((a, b) => a.order - b.order);
