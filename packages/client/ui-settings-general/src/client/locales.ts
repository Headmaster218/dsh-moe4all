/** Shell chrome and General-nav dictionaries; feature rows own their copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger': '设置',
  'title': '设置',
  'close': '关闭',
  'openDocument': '打开配置文件',
  'openDocument.error': '无法打开配置文件',
  'general.nav': '通用设置',
  'desktop.title': 'MoE4All Agent 更新',
  'desktop.check': '检查更新', 'desktop.progress': '查看进度', 'desktop.viewUpdate': '查看更新',
  'desktop.idle': '按需检查新版本', 'desktop.checking': '正在检查更新',
  'desktop.available': '发现新版本', 'desktop.current': '已是最新版本',
  'desktop.downloading': '正在下载更新', 'desktop.verifying': '正在校验下载',
  'desktop.extracting': '正在解压新版本', 'desktop.installing': '正在安装并重启',
  'desktop.error': '更新需要处理', 'desktop.wait': '请稍候', 'desktop.retry': '请检查网络后重试。',
  'desktop.installed': '当前版本', 'desktop.newVersion': '新版本',
  'desktop.keepData': '仅更新应用文件。模型、对话和缓存留在原处，保留上一个版本用于回退。',
  'desktop.install': '下载并安装', 'desktop.release': '查看发布说明',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
  'desktop.title': 'MoE4All Agent updates',
  'desktop.check': 'Check updates', 'desktop.progress': 'View progress', 'desktop.viewUpdate': 'View update',
  'desktop.idle': 'Check for a new version', 'desktop.checking': 'Checking for updates',
  'desktop.available': 'A new version is available', 'desktop.current': 'You are up to date',
  'desktop.downloading': 'Downloading update', 'desktop.verifying': 'Verifying download',
  'desktop.extracting': 'Unpacking the new version', 'desktop.installing': 'Installing and restarting',
  'desktop.error': 'Update needs attention', 'desktop.wait': 'Please wait', 'desktop.retry': 'Check your connection and try again.',
  'desktop.installed': 'Installed version', 'desktop.newVersion': 'New version',
  'desktop.keepData': 'Only application files change. Models, conversations and caches stay in place; one previous version is kept for rollback.',
  'desktop.install': 'Download and install', 'desktop.release': 'View release notes',
} satisfies Record<SettingsKey, string>
