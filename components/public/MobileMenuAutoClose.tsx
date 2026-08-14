'use client'
import { useEffect } from 'react'

/**
 * Closes the mobile menu when you tap something in it.
 *
 * THE NAV LINKS LOOKED BROKEN AND WERE NOT. The menu is a <details>
 * element, which is why it works with no JavaScript at all — but a
 * <details> does not close because you followed a link inside it. So
 * tapping "About Us" scrolled the page to About Us behind a menu panel
 * still covering the screen, and the only visible result was nothing
 * happening. Reported, correctly, as "the links don't work".
 *
 * One delegated listener on the document rather than a handler per
 * link: the nav is built server-side with React.createElement and the
 * entries change, and a listener that has to be remembered on every new
 * link is a listener that will be forgotten on one.
 */
export function MobileMenuAutoClose() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      // Anything that navigates or acts — a link, or the button that
      // opens the login dialog.
      const actionable = target.closest('a[href], button')
      if (!actionable) return

      const menu = actionable.closest('details.public-mobile-menu') as HTMLDetailsElement | null
      if (!menu) return

      // The summary IS the open/close control. Closing it here would
      // undo the tap that just opened the menu.
      if (actionable.closest('summary')) return

      menu.open = false
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
