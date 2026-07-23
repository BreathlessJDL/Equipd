import { Link } from 'react-router-dom'
import EquipmentCatalogueNav from '../components/admin/EquipmentCatalogueNav'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import '../components/admin/EquipmentCatalogueNav.css'

function AdminEquipmentCatalogueImportsPage() {
  usePageTitle('Imports — Equipment Catalogue')

  return (
    <div className="admin-intelligence admin-products">
      <EquipmentCatalogueNav
        title="Imports"
        subtitle="Bring catalogue data in from CSV and research spreadsheets."
      />

      <section className="admin-intelligence__panel">
        <h2 className="admin-intelligence__panel-title">Catalogue imports</h2>
        <div className="admin-intelligence__stats">
          <Link to="/admin/intelligence/import" className="admin-intelligence__stat" style={{ textDecoration: 'none' }}>
            <span>Canonical CSV</span>
            <strong>Import researched products</strong>
          </Link>
          <Link to="/admin/intelligence/original-prices-lifecycle" className="admin-intelligence__stat" style={{ textDecoration: 'none' }}>
            <span>Research spreadsheet</span>
            <strong>Import RRP &amp; lifecycle</strong>
          </Link>
        </div>
        <p className="admin-intelligence__lead" style={{ marginTop: '1rem' }}>
          Canonical CSV upserts products by slug and writes original RRP and baseline manufacture year
          directly onto catalogue products. Use the research queue for spreadsheet-assisted bulk edits.
          Raw automated intelligence ingestion remains separate and conservative.
        </p>
      </section>
    </div>
  )
}

export default AdminEquipmentCatalogueImportsPage
