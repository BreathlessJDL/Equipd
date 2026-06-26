import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  HELP_CATEGORY_SECTIONS,
  HELP_CENTRE_HERO,
  searchHelpArticles,
} from '../data/helpArticles'

export function useHelpCentreSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') ?? ''

  const setSearchQuery = useCallback(
    (value) => {
      const nextParams = new URLSearchParams(searchParams)

      if (value) {
        nextParams.set('q', value)
      } else {
        nextParams.delete('q')
      }

      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const searchResults = useMemo(() => searchHelpArticles(searchQuery), [searchQuery])
  const isSearching = searchQuery.trim().length > 0

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    emptySearchMessage: HELP_CENTRE_HERO.emptySearchMessage,
    categories: HELP_CATEGORY_SECTIONS,
  }
}
