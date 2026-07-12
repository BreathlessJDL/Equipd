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
            <span>Source CSV</span>
            <strong>Import intelligence CSV</strong>
          </Link>
          <Link to="/admin/intelligence/original-prices-lifecycle" className="admin-intelligence__stat" style={{ textDecoration: 'none' }}>
            <span>Research spreadsheet</span>
            <strong>Import RRP &amp; lifecycle</strong>
          </Link>
        </div>
        <p className="admin-intelligence__lead" style={{ marginTop: '1rem' }}>
          Use the research queue for spreadsheet import/export of original prices and manufacture years.
          Source CSV import still upserts raw intelligence rows that feed the catalogue.
        </p>
      </section>
    </div>
  )
}

export default AdminEquipmentCatalogueImportsPage
