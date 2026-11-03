import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  PRIVATE_EDIT_LISTING_DESCRIPTION,
  PRIVATE_EDIT_LISTING_TITLE,
  PRIVATE_PAGE_ROBOTS,
} from '../lib/privatePageNoindex'
import '../components/PageStub.css'

function PrivateEditListingGonePage() {
  usePageMeta({
    title: PRIVATE_EDIT_LISTING_TITLE,
    description: PRIVATE_EDIT_LISTING_DESCRIPTION,
    canonicalPath: '/',
    robotsContent: PRIVATE_PAGE_ROBOTS,
  })

  return (
    <section className="page-stub">
      <h1 className="page-stub__title">This page is not available</h1>
      <p className="page-stub__lead">
        Listing editing is private to the seller and cannot be opened from this address.
      </p>
      <p className="page-stub__lead">
        <Link to="/buy-used-gym-equipment">Buy used gym equipment</Link>
        {' · '}
        <Link to="/browse">Browse listings</Link>
      </p>
    </section>
  )
}

export default PrivateEditListingGonePage
