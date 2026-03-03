import type { SettingsConfigResponse } from '~~/app/types/settings'
import { getModelConfig, getPermissions, getAppearance, getAccountInfo, getAttribution, readSettings } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async (): Promise<SettingsConfigResponse> => {
  const [model, permissions, appearance, account, attribution, settings] = await Promise.all([
    getModelConfig(),
    getPermissions(),
    getAppearance(),
    getAccountInfo(),
    getAttribution(),
    readSettings(),
  ])

  return {
    model,
    permissions,
    appearance,
    account,
    attribution,
    cleanupPeriodDays: (settings.cleanupPeriodDays as number) ?? 30,
  }
})
