import { useParams } from 'react-router-dom'
import UserShopPage from './UserShopPage'

function ShopRoutePage() {
  const { shopParam } = useParams()

  return <UserShopPage shopParam={shopParam} />
}

export default ShopRoutePage
