import { updateModelConfig, updatePermissions, updateAppearance, updateAttribution } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (body.model) await updateModelConfig(body.model)
  if (body.permissions) await updatePermissions(body.permissions)
  if (body.appearance) await updateAppearance(body.appearance)
  if (body.attribution) await updateAttribution(body.attribution)

  return { ok: true }
})
