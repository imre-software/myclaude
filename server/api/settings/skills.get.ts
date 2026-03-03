import { getSkills } from '~~/server/utils/claudeConfig'

export default defineEventHandler(async () => {
  return getSkills()
})
