import './AppLogo.css'

type AppLogoVariant = 'full' | 'mark'
type AppLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'

const SIZE_PX: Record<AppLogoSize, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 40,
  xl: 64,
  xxl: 128,
  xxxl: 256,
}

interface AppLogoProps {
  variant?: AppLogoVariant
  size?: AppLogoSize
  className?: string
  alt?: string
}

export default function AppLogo({
  variant = 'mark',
  size = 'md',
  className = '',
  alt = 'Cortex',
}: AppLogoProps) {
  const src =
    variant === 'full'
      ? `${import.meta.env.BASE_URL}cortex-logo.png`
      : `${import.meta.env.BASE_URL}cortex-icon.png`

  return (
    <img
      src={src}
      alt={alt}
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      className={`app-logo-img ${className}`.trim()}
    />
  )
}