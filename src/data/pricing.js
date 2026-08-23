// Single source of truth for the pricing catalogue: slugs, ordering and the
// numeric base price (used for Offer JSON-LD). All human copy lives in i18n
// under `pricing.items.<i18nKey>` so every language carries its own wording.
export const pricingServices = [
  { slug: 'linux-devops',         i18nKey: 'linuxDevops',       order: 1,  basePrice: 490,  name: 'Linux Servers & DevOps' },
  { slug: 'backend-apis',         i18nKey: 'backendApis',       order: 2,  basePrice: 900,  name: 'Backend & APIs' },
  { slug: 'databases',            i18nKey: 'databases',         order: 3,  basePrice: 600,  name: 'Database Architecture' },
  { slug: 'react-websites',       i18nKey: 'reactWebsites',     order: 4,  basePrice: 490,  name: 'React Websites' },
  { slug: 'payment-integrations', i18nKey: 'paymentIntegrations', order: 5, basePrice: 700, name: 'Payment Integrations' },
  { slug: 'monitoring',           i18nKey: 'monitoring',        order: 6,  basePrice: 600,  name: 'Monitoring Systems' },
  { slug: 'admin-panels',         i18nKey: 'adminPanels',       order: 7,  basePrice: 1200, name: 'Admin Panels' },
  { slug: 'access-control',       i18nKey: 'accessControl',     order: 8,  basePrice: 1500, name: 'Access Control' },
  { slug: 'video-surveillance',   i18nKey: 'videoSurveillance', order: 9,  basePrice: 800,  name: 'Video Surveillance' },
  { slug: 'mvp-development',      i18nKey: 'mvpDevelopment',    order: 10, basePrice: 1900, name: 'MVP Development' },
  { slug: 'web3-development',     i18nKey: 'web3Development',   order: 11, basePrice: 1200, name: 'Web3 & Blockchain Development' },
  { slug: 'smart-contract-audit', i18nKey: 'smartContractAudit', order: 12, basePrice: 900, name: 'Smart Contract Audit' },
];

export function getServiceBySlug(slug) {
  return pricingServices.find((s) => s.slug === slug) || null;
}
