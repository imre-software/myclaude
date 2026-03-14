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
  whatsapp: {
    enabled: boolean
    phoneNumber: string
  }
  telegram: {
    enabled: boolean
    botToken: string
    chatId: string
    botName: string
    mentionOnly: boolean
  }
  remoteMode: {
    enabled: boolean
    hooks: {
      stop: boolean
      permissionRequest: boolean
      notification: boolean
    }
    channels: {
      whatsapp: boolean
      telegram: boolean
    }
    timeoutMinutes: number
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

export type NotificationSettingsUpdate = Partial<Omit<NotificationSettings, 'thresholds' | 'paceAlerts' | 'quietHours' | 'whatsapp' | 'telegram' | 'remoteMode'>> & {
  thresholds?: Partial<Record<NotificationWindowType, Partial<ThresholdConfig>>>
  paceAlerts?: Partial<NotificationSettings['paceAlerts']>
  quietHours?: Partial<NotificationSettings['quietHours']>
  whatsapp?: Partial<NotificationSettings['whatsapp']>
  telegram?: Partial<NotificationSettings['telegram']>
  remoteMode?: Partial<NotificationSettings['remoteMode']> & {
    hooks?: Partial<NotificationSettings['remoteMode']['hooks']>
    channels?: Partial<NotificationSettings['remoteMode']['channels']>
  }
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
  whatsapp: {
    enabled: false,
    phoneNumber: '',
  },
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
    botName: '',
    mentionOnly: false,
  },
  remoteMode: {
    enabled: false,
    hooks: {
      stop: true,
      permissionRequest: true,
      notification: true,
    },
    channels: {
      whatsapp: false,
      telegram: false,
    },
    timeoutMinutes: 60,
  },
}
