import { BrandWordmark, FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official whale mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <FishLogo size={size} className={className} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} />
}

export function Moe4AllBrandMark({ size, className }: OfficialBrandMarkProps) {
  return (
    <span className={className} style={{
      alignItems: 'center', background: 'var(--dsw-alias-brand-primary)', borderRadius: 4,
      color: 'var(--dsw-alias-label-primary-foreground)',
      display: 'inline-flex', fontSize: Math.round(size * 0.6), fontWeight: 800,
      height: size, justifyContent: 'center', lineHeight: 1, width: size,
    }}>M</span>
  )
}

export function Moe4AllBrandName() {
  return <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>MoE4All</span>
}
