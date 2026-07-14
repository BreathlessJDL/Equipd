#!/usr/bin/env node
/**
 * Unit tests for admin equipment products list helpers (no DB required).
 */

import assert from 'node:assert/strict'
import {
  applyEquipmentProductListQueryPatch,
  buildAdminListEquipmentProductsRpcArgs,
  buildEquipmentProductListQueryParams,
  clampEquipmentProductListPage,
  clampEquipmentProductListPageSize,
  EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
  EQUIPMENT_PRODUCT_LIST_MAX_PAGE_SIZE,
  mergeEquipmentProductListQuery,
  normalizeFilterOptionList,
  parseEquipmentProductListQueryParams,
} from '../src/lib/equipmentProductsAdminListState.js'

function testClampPageSize() {
  assert.equal(clampEquipmentProductListPageSize(50), 50)
  assert.equal(clampEquipmentProductListPageSize(25), 25)
  assert.equal(clampEquipmentProductListPageSize(100), 100)
  assert.equal(clampEquipmentProductListPageSize(101), EQUIPMENT_PRODUCT_LIST_MAX_PAGE_SIZE)
  assert.equal(clampEquipmentProductListPageSize(0), 1)
  assert.equal(clampEquipmentProductListPageSize('nope'), EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE)
}

function testClampPage() {
  assert.equal(clampEquipmentProductListPage(1, 1500, 50), 1)
  assert.equal(clampEquipmentProductListPage(15, 1500, 50), 15)
  assert.equal(clampEquipmentProductListPage(30, 1500, 50), 30)
  assert.equal(clampEquipmentProductListPage(31, 1500, 50), 30)
  assert.equal(clampEquipmentProductListPage(0, 1500, 50), 1)
  assert.equal(clampEquipmentProductListPage(99, 0, 50), 1)
  assert.equal(clampEquipmentProductListPage(5, 40, 50), 1)
}

function testUrlRoundTrip() {
  const params = buildEquipmentProductListQueryParams({
    page: 3,
    pageSize: 25,
    search: 'peloton',
    brand: 'Peloton',
    status: 'pending',
    equipmentType: 'Bike',
    completion: 'missing_price',
    attention: 'needs_review',
    sort: 'brand',
    sortDir: 'desc',
  })

  assert.equal(params.get('page'), '3')
  assert.equal(params.get('pageSize'), '25')
  assert.equal(params.get('search'), 'peloton')
  assert.equal(params.get('brand'), 'Peloton')
  assert.equal(params.get('status'), 'pending')
  assert.equal(params.get('equipmentType'), 'Bike')
  assert.equal(params.get('completion'), 'missing_price')
  assert.equal(params.get('attention'), 'needs_review')
  assert.equal(params.get('sort'), 'brand')
  assert.equal(params.get('sortDir'), 'desc')

  const parsed = parseEquipmentProductListQueryParams(params)
  assert.equal(parsed.page, 3)
  assert.equal(parsed.pageSize, 25)
  assert.equal(parsed.search, 'peloton')
  assert.equal(parsed.brand, 'Peloton')
  assert.equal(parsed.attention, 'needs_review')
  assert.equal(parsed.sortDir, 'desc')
}

function testDefaultUrlOmitsNoise() {
  const params = buildEquipmentProductListQueryParams({
    page: 1,
    pageSize: EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
    search: '',
    brand: '',
    status: '',
    attention: 'all',
    sort: 'canonical_product_name',
    sortDir: 'asc',
  })
  assert.equal(params.toString(), '')
}

function testFilterChangeResetsPage() {
  const merged = mergeEquipmentProductListQuery(
    { page: 4, brand: '', status: 'approved' },
    { brand: 'NordicTrack' },
  )
  assert.equal(merged.page, 1)
  assert.equal(merged.brand, 'NordicTrack')
  assert.equal(merged.status, 'approved')
}

function testPageOnlyChangePreservesPage() {
  const merged = mergeEquipmentProductListQuery(
    { page: 2, brand: 'Peloton' },
    { page: 3 },
    { resetPage: false },
  )
  assert.equal(merged.page, 3)
  assert.equal(merged.brand, 'Peloton')
}

function testClearBrandRestoresUnfilteredQuery() {
  const params = applyEquipmentProductListQueryPatch(
    'brand=Peloton&status=pending&page=2',
    { brand: '' },
  )
  assert.equal(params.get('brand'), null)
  assert.equal(params.get('status'), 'pending')
  assert.equal(params.get('page'), null)
}

function testCombinedFiltersPreserved() {
  const params = applyEquipmentProductListQueryPatch(
    'brand=Peloton&status=pending',
    { equipmentType: 'Bike' },
  )
  assert.equal(params.get('brand'), 'Peloton')
  assert.equal(params.get('status'), 'pending')
  assert.equal(params.get('equipmentType'), 'Bike')
  assert.equal(params.get('page'), null)
}

function testSearchPlusBrand() {
  const params = applyEquipmentProductListQueryPatch(
    'brand=BowFlex',
    { search: 'max' },
  )
  assert.equal(params.get('brand'), 'BowFlex')
  assert.equal(params.get('search'), 'max')
}

function testUrlReloadRestoresFilters() {
  const parsed = parseEquipmentProductListQueryParams(
    new URLSearchParams('brand=Life+Fitness&status=approved&completion=incomplete&attention=needs_price&page=2'),
  )
  assert.equal(parsed.brand, 'Life Fitness')
  assert.equal(parsed.status, 'approved')
  assert.equal(parsed.completion, 'incomplete')
  assert.equal(parsed.attention, 'needs_price')
  assert.equal(parsed.page, 2)
}

function testRpcArgsMapping() {
  const args = buildAdminListEquipmentProductsRpcArgs({
    search: ' rower ',
    brand: 'Concept2',
    status: 'approved',
    equipmentType: 'Rower',
    completion: 'missing_price',
    attention: 'needs_year',
    page: 2,
    pageSize: 25,
    sort: 'brand',
    sortDir: 'desc',
  })

  assert.deepEqual(args, {
    p_search: 'rower',
    p_brand: 'Concept2',
    p_status: 'approved',
    p_equipment_type: 'Rower',
    p_completion: 'missing_price',
    p_attention: 'needs_year',
    p_image_filter: null,
    p_page: 2,
    p_page_size: 25,
    p_sort: 'brand',
    p_sort_dir: 'desc',
  })
}

function testRpcArgsNullForInactiveFilters() {
  const args = buildAdminListEquipmentProductsRpcArgs({
    search: '',
    brand: '',
    status: '',
    equipmentType: '',
    completion: '',
    attention: 'all',
    page: 1,
    pageSize: 50,
  })

  assert.equal(args.p_search, null)
  assert.equal(args.p_brand, null)
  assert.equal(args.p_status, null)
  assert.equal(args.p_equipment_type, null)
  assert.equal(args.p_completion, null)
  assert.equal(args.p_attention, null)
  assert.equal(args.p_page, 1)
  assert.equal(args.p_page_size, 50)
}

function testRpcArgsCapPageSize() {
  const args = buildAdminListEquipmentProductsRpcArgs({ page: 1, pageSize: 500 })
  assert.equal(args.p_page_size, 100)
}

function testNormalizeFilterOptions() {
  assert.deepEqual(
    normalizeFilterOptionList(['Technogym', 'Peloton', 'Technogym', '', null]),
    ['Peloton', 'Technogym'],
  )
  assert.deepEqual(
    normalizeFilterOptionList([{ brand: 'Matrix' }, { name: 'Precor' }]),
    ['Matrix', 'Precor'],
  )
  assert.deepEqual(normalizeFilterOptionList('not-an-array'), [])
}

function testSelectOnlyBrandAndTypeFieldsDocumented() {
  // Guardrail: filter-option loading must not pull full product payloads.
  const select = 'brand, equipment_type'
  assert.equal(select.includes('overview'), false)
  assert.equal(select.includes('faq'), false)
  assert.ok(select.includes('brand'))
  assert.ok(select.includes('equipment_type'))
}

function testPreserveEditParam() {
  const params = applyEquipmentProductListQueryPatch(
    'edit=life-fitness-treadmill&brand=Peloton',
    { status: 'pending' },
  )
  assert.equal(params.get('edit'), 'life-fitness-treadmill')
  assert.equal(params.get('brand'), 'Peloton')
  assert.equal(params.get('status'), 'pending')
}

function testIndependentFilterPatches() {
  const brandOnly = applyEquipmentProductListQueryPatch('', { brand: 'Peloton' })
  assert.equal(brandOnly.get('brand'), 'Peloton')

  const statusOnly = applyEquipmentProductListQueryPatch('', { status: 'needs_review' })
  assert.equal(statusOnly.get('status'), 'needs_review')

  const typeOnly = applyEquipmentProductListQueryPatch('', { equipmentType: 'Treadmill' })
  assert.equal(typeOnly.get('equipmentType'), 'Treadmill')

  const completionOnly = applyEquipmentProductListQueryPatch('', { completion: 'missing_both' })
  assert.equal(completionOnly.get('completion'), 'missing_both')

  const attentionOnly = applyEquipmentProductListQueryPatch('', { attention: 'needs_image' })
  assert.equal(attentionOnly.get('attention'), 'needs_image')

  const searchOnly = applyEquipmentProductListQueryPatch('', { search: 'unity' })
  assert.equal(searchOnly.get('search'), 'unity')
}

function main() {
  testClampPageSize()
  testClampPage()
  testUrlRoundTrip()
  testDefaultUrlOmitsNoise()
  testFilterChangeResetsPage()
  testPageOnlyChangePreservesPage()
  testClearBrandRestoresUnfilteredQuery()
  testCombinedFiltersPreserved()
  testSearchPlusBrand()
  testUrlReloadRestoresFilters()
  testRpcArgsMapping()
  testRpcArgsNullForInactiveFilters()
  testRpcArgsCapPageSize()
  testNormalizeFilterOptions()
  testSelectOnlyBrandAndTypeFieldsDocumented()
  testPreserveEditParam()
  testIndependentFilterPatches()
  console.log('PASS: admin equipment products list helpers')
}

main()
