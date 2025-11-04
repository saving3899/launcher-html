/**
 * API 모델 목록
 * 실리태번과 동일한 모델 목록 (2025년 최신 버전)
 */

// OpenAI 모델 목록 (실리태번 index.html 기준)
const OPENAI_MODELS = [
    // GPT-5
    'gpt-5',
    'gpt-5-2025-08-07',
    'gpt-5-chat-latest',
    'gpt-5-mini',
    'gpt-5-mini-2025-08-07',
    'gpt-5-nano',
    'gpt-5-nano-2025-08-07',
    // GPT-4o
    'gpt-4o',
    'gpt-4o-2024-11-20',
    'gpt-4o-2024-08-06',
    'gpt-4o-2024-05-13',
    'chatgpt-4o-latest',
    // GPT-4o mini
    'gpt-4o-mini',
    'gpt-4o-mini-2024-07-18',
    // GPT-4.1
    'gpt-4.1',
    'gpt-4.1-2025-01-13',
    'gpt-4.1-2024-12-10',
    // o1
    'o1',
    'o1-2024-12-17',
    'o1-preview',
    // o3
    'o3',
    'o3-mini',
    'o3-mini-2025-01-31',
    // o4
    'o4',
    'o4-mini',
    // GPT-4.5
    'gpt-4.5',
    'gpt-4.5-2025-01-27',
    // GPT-4 Turbo and GPT-4
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',
    'gpt-4-turbo-preview',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-4-0613',
    // GPT-3.5 Turbo
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-16k-0613',
];

// Anthropic (Claude) 모델 목록
const ANTHROPIC_MODELS = [
    // Claude 3.7 Sonnet
    'claude-3-7-sonnet-20250219',
    // Claude 3.5 Sonnet
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    // Claude 3 Opus
    'claude-3-opus-20240229',
    // Claude 3 Sonnet
    'claude-3-sonnet-20240229',
    // Claude 3 Haiku
    'claude-3-haiku-20240307',
    // Claude 3.5 Opus
    'claude-3-5-opus-20241022',
    // Claude 3 Opus (legacy)
    'claude-3-opus-20240229',
    // Claude 3.5 Haiku
    'claude-3-5-haiku-20241022',
];

// Google Gemini 모델 목록 (MakerSuite)
const GEMINI_MODELS = [
    // Gemini 2.5
    'gemini-2.5-pro',
    'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.5-pro-preview-03-25',
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-09-2025',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-lite-preview-09-2025',
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    // Gemini 2.0
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-lite-preview-02-05',
    // Gemini 1.5
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    // Gemini 1.0
    'gemini-pro',
    'gemini-pro-vision',
    // Gemma
    'gemma-2-27b-it',
    'gemma-2-9b-it',
    'gemma-7b-it',
    'gemma-2b-it',
    // LearnLM
    'learnlm-chat-001',
    'learnlm-1.5-pro-experimental',
    // Robotics-ER
    'gemini-robotics-er-1.5-preview',
];

// Mistral AI 모델 목록
const MISTRALAI_MODELS = [
    'mistral-large-2411',
    'mistral-large-2407',
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'pixtral-large-latest',
    'pixtral-12b-2409',
    'mistral-small-2409',
    'mistral-tiny',
];

// Cohere 모델 목록
const COHERE_MODELS = [
    'command-r-plus-08-2024',
    'command-r7b-12-2024',
    'command-r-08-2024',
    'command-r-plus',
    'command-r',
    'command',
    'command-light',
];

// Perplexity 모델 목록
const PERPLEXITY_MODELS = [
    'sonar-pro',
    'sonar',
    'sonar-online',
    'llama-3.1-sonar-large-128k-online',
    'llama-3.1-sonar-large-128k-chat',
    'llama-3.1-sonar-small-128k-online',
    'llama-3.1-sonar-small-128k-chat',
    'llama-3.1-sonar-huge-128k-online',
    'llama-3.1-sonar-huge-128k-chat',
    'sonar-medium-online',
    'sonar-medium-chat',
];

// Groq 모델 목록
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3-70b-8192',
    'llama-3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma-7b-it',
];

// DeepSeek 모델 목록
const DEEPSEEK_MODELS = [
    'deepseek-chat',
    'deepseek-reasoner',
    'deepseek-coder',
];

// xAI (Grok) 모델 목록
const XAI_MODELS = [
    'grok-2-1212',
    'grok-2-vision-1212',
    'grok-beta',
    'grok-vision-beta',
    'grok-2',
    'grok-2-vision',
];

// Moonshot AI 모델 목록
const MOONSHOT_MODELS = [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k',
];

// Fireworks 모델 목록
const FIREWORKS_MODELS = [
    'accounts/fireworks/models/kimi-k2-instruct',
    'accounts/fireworks/models/llama-v3p1-405b-instruct',
    'accounts/fireworks/models/llama-v3p1-70b-instruct',
];

// AI21 모델 목록
const AI21_MODELS = [
    'jamba-1.5-large',
    'jamba-1.5-small',
    'jamba-1.5-mini',
];

/**
 * 제공업체별 모델 목록 가져오기
 * @param {string} provider - API 제공업체
 * @returns {Array<string>} 모델 목록
 */
function getModelsForProvider(provider) {
    switch (provider?.toLowerCase()) {
        case 'openai':
            return OPENAI_MODELS;
        case 'claude':
        case 'anthropic':
            return ANTHROPIC_MODELS;
        case 'makersuite':
        case 'gemini':
        case 'google':
            return GEMINI_MODELS;
        case 'vertexai':
            return GEMINI_MODELS; // Vertex AI도 같은 Gemini 모델 사용
        case 'mistralai':
        case 'mistral':
            return MISTRALAI_MODELS;
        case 'cohere':
            return COHERE_MODELS;
        case 'perplexity':
            return PERPLEXITY_MODELS;
        case 'groq':
            return GROQ_MODELS;
        case 'deepseek':
            return DEEPSEEK_MODELS;
        case 'xai':
            return XAI_MODELS;
        case 'moonshot':
            return MOONSHOT_MODELS;
        case 'fireworks':
            return FIREWORKS_MODELS;
        case 'ai21':
            return AI21_MODELS;
        case 'openrouter':
        case 'electronhub':
        case 'nanogpt':
        case 'aimlapi':
        case 'pollinations':
        case 'cometapi':
        case 'custom':
        case 'azure_openai':
        case 'zai':
            // 동적 모델 목록 (API에서 가져와야 함)
            return [];
        default:
            return [];
    }
}

/**
 * 제공업체 표시 이름
 */
const PROVIDER_DISPLAY_NAMES = {
    'openai': 'OpenAI',
    'claude': 'Anthropic (Claude)',
    'openrouter': 'OpenRouter',
    'ai21': 'AI21',
    'makersuite': 'Google AI Studio',
    'vertexai': 'Google Vertex AI',
    'mistralai': 'Mistral AI',
    'custom': 'Custom',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
    'groq': 'Groq',
    'electronhub': 'ElectronHub',
    'nanogpt': 'NanoGPT',
    'deepseek': 'DeepSeek',
    'aimlapi': 'AIML API',
    'xai': 'xAI (Grok)',
    'pollinations': 'Pollinations',
    'moonshot': 'Moonshot AI',
    'fireworks': 'Fireworks',
    'cometapi': 'Comet API',
    'azure_openai': 'Azure OpenAI',
    'zai': 'Z.AI',
};
