import { useParams } from 'react-router-dom'
import UserShopPage from './UserShopPage'

function ShopRoutePage() {
  const { userId } = useParams()

  return <UserShopPage userId={userId} />
}

export default ShopRoutePage
