import PublicLodgePage from './[slug]/page'

const LODGE_SLUG = 'psalms-of-job-1827'

export default async function RootPage() {
  return await PublicLodgePage({
    params: { slug: LODGE_SLUG },
  })
}