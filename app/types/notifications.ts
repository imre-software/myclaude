export type NotificationWindowType = 'fiveHour' | 'sevenDay' | 'sevenDaySonnet'

export interface ThresholdConfig {
  enabled: boolean
  levels: number[]
}

export interface NotificationSettings {
  enabled: boolean
  thresholds: {
    fiveHour: ThresholdConfig
    sevenDay: ThresholdConfig
    sevenDaySonnet: ThresholdConfig
  }
  cooldownMinutes: number
  sound: string
  paceAlerts: {
    enabled: boolean
    workDayHours: number
    workDaysPerWeek: number
  }
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
}

export interface NotificationRecord {
  id: number
  type: 'threshold' | 'pace' | 'summary'
  windowType: NotificationWindowType | null
  thresholdLevel: number | null
  title: string
  body: string
  utilization: number | null
  createdAt: string
  read: boolean
}

export type NotificationSettingsUpdate = Partial<Omit<NotificationSettings, 'thresholds' | 'paceAlerts' | 'quietHours'>> & {
  thresholds?: Partial<Record<NotificationWindowType, Partial<ThresholdConfig>>>
  paceAlerts?: Partial<NotificationSettings['paceAlerts']>
  quietHours?: Partial<NotificationSettings['quietHours']>
}

export interface DebounceEntry {
  lastFiredAt: number
  lastUtilization: number
}

export const NOTIFICATION_DEFAULTS: NotificationSettings = {
  enabled: true,
  thresholds: {
    fiveHour: { enabled: true, levels: [75, 90] },
    sevenDay: { enabled: true, levels: [50, 75, 90] },
    sevenDaySonnet: { enabled: true, levels: [50, 75, 90] },
  },
  cooldownMinutes: 30,
  sound: 'default',
  paceAlerts: { enabled: false, workDayHours: 8, workDaysPerWeek: 5 },
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
}
