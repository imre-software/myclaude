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
    levels: number[]
    windows: {
      fiveHour: boolean
      sevenDay: boolean
      sevenDaySonnet: boolean
    }
  }
  quietHours: {
    enabled: boolean
    start: string
    end: string
  }
  closeToTray: boolean
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
  paceAlerts: {
    enabled: true,
    levels: [80, 90],
    windows: { fiveHour: true, sevenDay: true, sevenDaySonnet: true },
  },
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  closeToTray: true,
}
