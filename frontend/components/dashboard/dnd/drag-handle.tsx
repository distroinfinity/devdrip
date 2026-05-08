export function DragHandle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3" cy="2" r="1" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="3" cy="10" r="1" />
      <circle cx="9" cy="2" r="1" />
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="10" r="1" />
    </svg>
  )
}
