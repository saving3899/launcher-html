/**
 * 토큰 비용 절감 유틸리티
 * 실리태번의 토큰 최적화 전략 구현
 * 
 * 주요 기능:
 * 1. 프롬프트 캐싱 (Prompt Caching)
 * 2. 토큰 예산 계산 (Token Budget Calculation)
 * 3. Reasoning Effort 관리
 */

/**
 * Reasoning Effort 레벨
 */
const REASONING_EFFORT = {
    auto: 'auto',
    low: 'low',
    medium: 'medium',
    high: 'high',
    min: 'min',
    max: 'max',
};

/**
 * Claude 모델용 토큰 예산 계산
 * @param {number} maxTokens - 최대 토큰 수
 * @param {string} reasoningEffort - Reasoning effort 레벨 (auto, min, low, medium, high, max)
 * @param {boolean} stream - 스트리밍 여부
 * @returns {number|null} 예산 토큰 수 (auto인 경우 null)
 */
function calculateClaudeBudgetTokens(maxTokens, reasoningEffort, stream = false) {
    let budgetTokens = 0;

    switch (reasoningEffort) {
        case REASONING_EFFORT.auto:
            return null;
        case REASONING_EFFORT.min:
            budgetTokens = 1024;
            break;
        case REASONING_EFFORT.low:
            budgetTokens = Math.floor(maxTokens * 0.1);
            break;
        case REASONING_EFFORT.medium:
            budgetTokens = Math.floor(maxTokens * 0.25);
            break;
        case REASONING_EFFORT.high:
            budgetTokens = Math.floor(maxTokens * 0.5);
            break;
        case REASONING_EFFORT.max:
            budgetTokens = Math.floor(maxTokens * 0.95);
            break;
        default:
            return null;
    }

    budgetTokens = Math.max(budgetTokens, 1024);

    if (!stream) {
        budgetTokens = Math.min(budgetTokens, 21333);
    }

    return budgetTokens;
}

/**
 * Google/Gemini 모델용 토큰 예산 계산
 * @param {number} maxTokens - 최대 토큰 수
 * @param {string} reasoningEffort - Reasoning effort 레벨
 * @param {string} model - 모델 이름 (gemini-2.5-flash 등)
 * @returns {number} 예산 토큰 수 (auto인 경우 -1, min인 경우 0)
 */
function calculateGoogleBudgetTokens(maxTokens, reasoningEffort, model = '') {
    let budgetTokens = 0;

    switch (reasoningEffort) {
        case REASONING_EFFORT.auto:
            return -1;
        case REASONING_EFFORT.min:
            return 0;
        case REASONING_EFFORT.low:
            budgetTokens = Math.floor(maxTokens * 0.1);
            break;
        case REASONING_EFFORT.medium:
            budgetTokens = Math.floor(maxTokens * 0.25);
            break;
        case REASONING_EFFORT.high:
            budgetTokens = Math.floor(maxTokens * 0.5);
            break;
        case REASONING_EFFORT.max:
            budgetTokens = maxTokens;
            break;
        default:
            return -1;
    }

    // 모델별 최대값 설정
    if (model.includes('flash-lite')) {
        budgetTokens = Math.max(Math.min(budgetTokens, 24576), 512);
    } else if (model.includes('flash')) {
        budgetTokens = Math.max(Math.min(budgetTokens, 32768), 128);
    } else {
        budgetTokens = Math.min(budgetTokens, 24576);
    }

    return budgetTokens;
}

/**
 * Claude 메시지 배열에 캐싱 제어 추가 (깊이별 캐싱)
 * 실리태번의 cachingAtDepthForClaude 구현
 * @param {Array} messages - Claude API 메시지 배열
 * @param {number} cachingAtDepth - 캐싱할 깊이 (-1이면 비활성화)
 * @param {string} ttl - 캐시 TTL ('5m' 또는 '1h')
 * @returns {void} 메시지 배열을 직접 수정
 */
function cachingAtDepthForClaude(messages, cachingAtDepth, ttl = '5m') {
    if (!Array.isArray(messages) || cachingAtDepth < 0) {
        return;
    }

    let passedThePrefill = false;
    let depth = 0;
    let previousRoleName = '';

    for (let i = messages.length - 1; i >= 0; i--) {
        // Prefill 메시지 건너뛰기
        if (!passedThePrefill && messages[i].role === 'assistant') {
            continue;
        }

        passedThePrefill = true;

        // 역할이 변경될 때마다 깊이 증가
        if (messages[i].role !== previousRoleName) {
            // 지정된 깊이에 캐싱 추가
            if (depth === cachingAtDepth || depth === cachingAtDepth + 2) {
                const content = messages[i].content;
                
                // content가 배열인 경우 (일반적인 경우)
                if (Array.isArray(content) && content.length > 0) {
                    const lastContent = content[content.length - 1];
                    if (lastContent && typeof lastContent === 'object') {
                        lastContent.cache_control = { type: 'ephemeral', ttl: ttl };
                    }
                } else if (typeof content === 'string') {
                    // content가 문자열인 경우 배열로 변환
                    messages[i].content = [{
                        type: 'text',
                        text: content,
                        cache_control: { type: 'ephemeral', ttl: ttl }
                    }];
                }
            }

            // 캐싱 범위를 벗어나면 종료
            if (depth === cachingAtDepth + 2) {
                break;
            }

            depth += 1;
            previousRoleName = messages[i].role;
        }
    }
}

/**
 * OpenRouter Claude 메시지 배열에 캐싱 제어 추가
 * @param {Array} messages - 메시지 배열
 * @param {number} cachingAtDepth - 캐싱할 깊이
 * @param {string} ttl - 캐시 TTL
 * @returns {void}
 */
function cachingAtDepthForOpenRouterClaude(messages, cachingAtDepth, ttl = '5m') {
    if (!Array.isArray(messages) || cachingAtDepth < 0) {
        return;
    }

    let passedThePrefill = false;
    let depth = 0;
    let previousRoleName = '';

    for (let i = messages.length - 1; i >= 0; i--) {
        if (!passedThePrefill && messages[i].role === 'assistant') {
            continue;
        }

        passedThePrefill = true;

        if (messages[i].role !== previousRoleName) {
            if (depth === cachingAtDepth || depth === cachingAtDepth + 2) {
                const content = messages[i].content;
                
                // 문자열인 경우 배열로 변환
                if (typeof content === 'string') {
                    messages[i].content = [{
                        type: 'text',
                        text: content,
                        cache_control: { type: 'ephemeral', ttl: ttl },
                    }];
                } else if (Array.isArray(content) && content.length > 0) {
                    // 배열인 경우 마지막 요소에 캐싱 추가
                    const contentPartCount = content.length;
                    content[contentPartCount - 1].cache_control = {
                        type: 'ephemeral',
                        ttl: ttl,
                    };
                }
            }

            if (depth === cachingAtDepth + 2) {
                break;
            }

            depth += 1;
            previousRoleName = messages[i].role;
        }
    }
}

/**
 * 시스템 프롬프트에 캐싱 제어 추가
 * @param {Array} systemPrompt - 시스템 프롬프트 배열
 * @param {string} ttl - 캐시 TTL
 * @returns {void}
 */
function addSystemPromptCache(systemPrompt, ttl = '5m') {
    if (!Array.isArray(systemPrompt) || systemPrompt.length === 0) {
        return;
    }

    // 마지막 시스템 프롬프트에 캐싱 추가
    const lastPrompt = systemPrompt[systemPrompt.length - 1];
    if (lastPrompt && typeof lastPrompt === 'object') {
        lastPrompt.cache_control = { type: 'ephemeral', ttl: ttl };
    }
}

/**
 * 도구(Tools) 배열에 캐싱 제어 추가
 * @param {Array} tools - 도구 배열
 * @param {string} ttl - 캐시 TTL
 * @returns {void}
 */
function addToolsCache(tools, ttl = '5m') {
    if (!Array.isArray(tools) || tools.length === 0) {
        return;
    }

    // 마지막 도구에 캐싱 추가
    const lastTool = tools[tools.length - 1];
    if (lastTool && typeof lastTool === 'object') {
        lastTool.cache_control = { type: 'ephemeral', ttl: ttl };
    }
}

/**
 * 설정에서 토큰 최적화 옵션 가져오기
 * @param {Function} getConfigValue - 설정값 가져오기 함수 (선택사항)
 * @returns {Object} 최적화 옵션
 */
function getTokenOptimizationOptions(getConfigValue = null) {
    // 기본값
    const defaultOptions = {
        enableSystemPromptCache: false,
        cachingAtDepth: -1, // -1이면 비활성화
        extendedTTL: false, // false면 5m, true면 1h
    };

    // 설정 함수가 제공되면 설정값 사용
    if (typeof getConfigValue === 'function') {
        return {
            enableSystemPromptCache: getConfigValue('claude.enableSystemPromptCache', false, 'boolean'),
            cachingAtDepth: getConfigValue('claude.cachingAtDepth', -1, 'number'),
            extendedTTL: getConfigValue('claude.extendedTTL', false, 'boolean'),
        };
    }

    // 설정 함수가 없으면 localStorage에서 읽기 시도
    try {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        const claudeSettings = settings.claude || {};
        
        return {
            enableSystemPromptCache: claudeSettings.enableSystemPromptCache || defaultOptions.enableSystemPromptCache,
            cachingAtDepth: typeof claudeSettings.cachingAtDepth === 'number' ? claudeSettings.cachingAtDepth : defaultOptions.cachingAtDepth,
            extendedTTL: claudeSettings.extendedTTL || defaultOptions.extendedTTL,
        };
    } catch (e) {
        return defaultOptions;
    }
}

// 전역 스코프에 노출 (ES6 모듈 대신 전역 함수로)
if (typeof window !== 'undefined') {
    window.tokenOptimization = {
        calculateClaudeBudgetTokens,
        calculateGoogleBudgetTokens,
        cachingAtDepthForClaude,
        cachingAtDepthForOpenRouterClaude,
        addSystemPromptCache,
        addToolsCache,
        getTokenOptimizationOptions,
        REASONING_EFFORT,
    };
}

