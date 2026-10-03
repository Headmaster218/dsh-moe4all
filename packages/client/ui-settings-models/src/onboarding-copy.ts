/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-13.1'

/** The complete editable internal-testing notice in both supported GUI locales. */
const MOE4ALL_WELCOME_NOTICE_COPY = {
  zh: {
    title: '欢迎使用 MoE4All',
    body: 'MoE4All 希望让不同显卡上的 AI 都更易用。从本地模型与专家推理起步，我们会继续拓展更多创作与处理能力。\n\n这是一个持续完善中的版本。插件沿用 DSH 生态，但 MoE4All 的设置、凭据和工作区独立保存。欢迎反馈实际使用中遇到的问题。',
    continueLabel: '开始使用',
  },
  en: {
    title: 'Welcome to MoE4All',
    body: 'MoE4All aims to make AI more accessible across GPUs. We are starting with local models and expert inference, with more ways to create and process content ahead.\n\nThis release is still evolving. Plugins remain compatible with the DSH ecosystem, while MoE4All keeps its own settings, credentials, and workspace. We welcome your feedback.',
    continueLabel: 'Get started',
  },
} as const

const DSH_WELCOME_NOTICE_COPY = {
  zh: {
    title: '内测声明',
    body: 'DeepSeek Harness 目前的 0.1 版本仍处在面向 Harness 开发者进行测试的阶段，还有许多地方需要持续改进和打磨，希望听取广大开发者的反馈建议。预计 DeepSeek Harness 的核心插件以及基础 API 都会在接下来的一段时间内快速迭代、持续演化。\n\n我们期待与全球开发者一起，在开源、开放、可复用、可组合的基础设施之上，共同探索智能上限。欢迎全球 Harness 开发者加入 DSH 插件生态。',
    continueLabel: '继续',
  },
  en: {
    title: 'Internal Testing Notice',
    body: "DeepSeek Harness 0.1 remains in testing for Harness developers. Many areas need further improvement, and we welcome feedback from the developer community. DeepSeek Harness's core plugins and foundational APIs will continue to evolve rapidly over the coming months.\n\nWe look forward to exploring the limits of intelligence with developers around the world, building on open-source, open, reusable, and composable infrastructure. We welcome Harness developers everywhere to join the DSH plugin ecosystem.",
    continueLabel: 'Continue',
  },
} as const

export const WELCOME_NOTICE_COPY = process.env.DSH_CLIENT_BUILD_PROFILE === 'moe4all'
  ? MOE4ALL_WELCOME_NOTICE_COPY
  : DSH_WELCOME_NOTICE_COPY
