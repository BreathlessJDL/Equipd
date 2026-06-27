import { useEffect } from 'react'
import { DEFAULT_PAGE_TITLE, formatPageTitle } from '../lib/pageTitles'

export function usePageTitle(pageTitle) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = pageTitle ? formatPageTitle(pageTitle) : DEFAULT_PAGE_TITLE

    return () => {
      document.title = previousTitle
    }
  }, [pageTitle])
}
