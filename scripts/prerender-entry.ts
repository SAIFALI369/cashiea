// Bundle entry for scripts/prerender.mjs. esbuild compiles this (and the
// TS modules it pulls in) to a single Node-loadable ESM file so the build
// script can read the real site content instead of a duplicated copy.
// Import only pure data/logic modules here — nothing that touches the DOM.

export {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  SUPPORT_EMAIL,
  OG_IMAGE_PATH,
  ROUTE_META,
  metaForPath,
} from '../src/lib/site'
export { HELP_ARTICLES, HELP_CATEGORIES } from '../src/lib/helpArticles'
export { BLOG_POSTS } from '../src/lib/blogPosts'
export { LANDING_FAQS, PRICING_FAQS } from '../src/lib/faqs'
export { FEATURE_LIST } from '../src/lib/structuredData'
export { schemaForPath } from '../src/lib/routeSchema'
export { PLANS } from '../src/lib/types'
