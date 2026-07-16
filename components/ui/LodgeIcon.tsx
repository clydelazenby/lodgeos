import Image from 'next/image'

export type LodgeIconName = 'ai-assistant' | 'attendance' | 'become-mason' | 'blood-drop' | 'book' | 'brotherhood' | 'calendar' | 'candidates' | 'charity' | 'clock' | 'coffee' | 'column' | 'committees' | 'compass-square' | 'contact' | 'dashboard' | 'documents' | 'dues-finance' | 'gallery' | 'gavel' | 'handshake' | 'heart-hands' | 'leadership' | 'location' | 'lodge-room' | 'meetings' | 'members' | 'messages' | 'officers' | 'payments' | 'personal-growth' | 'reports' | 'request-info' | 'scholarship' | 'settings' | 'tour' | 'visit-lodge'

const iconMap: Record<LodgeIconName, string> = {
  'ai-assistant': '/assets/lodgeos/icons/ai-assistant.svg',
  'attendance': '/assets/lodgeos/icons/attendance.svg',
  'become-mason': '/assets/lodgeos/icons/become-mason.svg',
  'blood-drop': '/assets/lodgeos/icons/blood-drop.svg',
  'book': '/assets/lodgeos/icons/book.svg',
  'brotherhood': '/assets/lodgeos/icons/brotherhood.svg',
  'calendar': '/assets/lodgeos/icons/calendar.svg',
  'candidates': '/assets/lodgeos/icons/candidates.svg',
  'charity': '/assets/lodgeos/icons/charity.svg',
  'clock': '/assets/lodgeos/icons/clock.svg',
  'coffee': '/assets/lodgeos/icons/coffee.svg',
  'column': '/assets/lodgeos/icons/column.svg',
  'committees': '/assets/lodgeos/icons/committees.svg',
  'compass-square': '/assets/lodgeos/icons/compass-square.svg',
  'contact': '/assets/lodgeos/icons/contact.svg',
  'dashboard': '/assets/lodgeos/icons/dashboard.svg',
  'documents': '/assets/lodgeos/icons/documents.svg',
  'dues-finance': '/assets/lodgeos/icons/dues-finance.svg',
  'gallery': '/assets/lodgeos/icons/gallery.svg',
  'gavel': '/assets/lodgeos/icons/gavel.svg',
  'handshake': '/assets/lodgeos/icons/handshake.svg',
  'heart-hands': '/assets/lodgeos/icons/heart-hands.svg',
  'leadership': '/assets/lodgeos/icons/leadership.svg',
  'location': '/assets/lodgeos/icons/location.svg',
  'lodge-room': '/assets/lodgeos/icons/lodge-room.svg',
  'meetings': '/assets/lodgeos/icons/meetings.svg',
  'members': '/assets/lodgeos/icons/members.svg',
  'messages': '/assets/lodgeos/icons/messages.svg',
  'officers': '/assets/lodgeos/icons/officers.svg',
  'payments': '/assets/lodgeos/icons/payments.svg',
  'personal-growth': '/assets/lodgeos/icons/personal-growth.svg',
  'reports': '/assets/lodgeos/icons/reports.svg',
  'request-info': '/assets/lodgeos/icons/request-info.svg',
  'scholarship': '/assets/lodgeos/icons/scholarship.svg',
  'settings': '/assets/lodgeos/icons/settings.svg',
  'tour': '/assets/lodgeos/icons/tour.svg',
  'visit-lodge': '/assets/lodgeos/icons/visit-lodge.svg',
}

export default function LodgeIcon({
  name,
  size = 32,
  alt,
  className,
}: {
  name: LodgeIconName
  size?: number
  alt?: string
  className?: string
}) {
  return (
    <Image
      src={iconMap[name]}
      alt={alt || name.replace(/-/g, ' ')}
      width={size}
      height={size}
      className={className}
    />
  )
}
