import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          borderRadius: 40,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="108"
          height="108"
          fill="none"
        >
          <path
            d="M13 2L4 14H11L10 22L20 9H13L13 2Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  )
}
