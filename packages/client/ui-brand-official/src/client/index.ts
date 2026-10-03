/** Official DeepSeek Harness occupants for the generic browser-brand slots. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { Moe4AllBrandMark, Moe4AllBrandName, OfficialBrandMark, OfficialBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill every shipped brand slot as one declaration-aware registration set.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const profile = process.env.DSH_CLIENT_BUILD_PROFILE
  if (profile !== 'official' && profile !== 'moe4all') return
  const BrandMark = profile === 'moe4all' ? Moe4AllBrandMark : OfficialBrandMark
  const BrandName = profile === 'moe4all' ? Moe4AllBrandName : OfficialBrandName
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark' }, BrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name' }, BrandName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, BrandMark)
      })))
}
