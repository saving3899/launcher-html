/**
 * OpenRouter API 통신 모듈
 * 실리태번 방식 참고
 */


const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter 헤더 (실리태번 방식)
const OPENROUTER_HEADERS = {
    'HTTP-Referer': 'https://sillytavern.app',
    'X-Title': 'SillyTavern',
};

/**
 * OpenRouter API 호출
 * @param {object} options - API 옵션
 * @param {string} options.reasoningEffort - Reasoning effort ('auto', 'min', 'low', 'medium', 'high', 'max')
 * @param {number} options.cachingAtDepth - 캐싱할 깊이 (-1이면 비활성화, 0 이상이면 활성화)
 * @param {boolean} options.extendedTTL - 캐시 TTL 연장 (false면 5m, true면 1h)
 * @param {boolean} options.enableWebSearch - 웹 검색 활성화
 */
async function callOpenRouter({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
    reasoningEffort = 'auto',
    cachingAtDepth = -1,
    extendedTTL = false,
    enableWebSearch = false,
}) {
    if (!apiKey) {
        throw new Error('OpenRouter API 키가 필요합니다.');
    }

    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    // OpenRouter에서 Claude 모델 사용 시 캐싱 적용
    const isClaude3or4 = /anthropic\/claude-(3|opus-4|sonnet-4|haiku-4)/.test(model);
    if (isClaude3or4 && window.tokenOptimization) {
        let optimizationOptions = {};
        if (typeof window !== 'undefined' && window.tokenOptimization) {
            optimizationOptions = window.tokenOptimization.getTokenOptimizationOptions();
        }
        
        const actualCachingAtDepth = cachingAtDepth >= 0 ? cachingAtDepth : (optimizationOptions.cachingAtDepth || -1);
        const actualExtendedTTL = extendedTTL || (optimizationOptions.extendedTTL || false);
        const cacheTTL = actualExtendedTTL ? '1h' : '5m';

        // OpenRouter용 Claude 캐싱 적용
        if (actualCachingAtDepth >= 0) {
            window.tokenOptimization.cachingAtDepthForOpenRouterClaude(filteredMessages, actualCachingAtDepth, cacheTTL);
        }
    }

    const requestBody = {
        model: model,
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    // Reasoning effort 지원 (OpenRouter는 일부 모델에서 지원)
    if (reasoningEffort && reasoningEffort !== 'auto' && window.tokenOptimization) {
        const isClaude = /anthropic\/claude/.test(model);
        if (isClaude) {
            const budgetTokens = window.tokenOptimization.calculateClaudeBudgetTokens(maxTokens, reasoningEffort, stream);
            if (Number.isInteger(budgetTokens)) {
                requestBody.reasoning = { effort: reasoningEffort };
            }
        }
    }

    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop;
    }

    // 실리태번과 동일: 웹 검색 활성화 (100-106번 라인)
    // OpenRouter는 plugins 배열에 web을 추가
    if (enableWebSearch) {
        requestBody.plugins = [{ id: 'web' }];
    }

    const url = `${OPENROUTER_API_BASE_URL}/chat/completions`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                ...OPENROUTER_HEADERS,
            },
            body: JSON.stringify(requestBody),
            signal: signal,
        });

        if (stream) {
            return await parseStreamingResponse(response, 'openai', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10020', 'OpenRouter 스트리밍 오류', error);
                    }
                    throw error;
                },
            });
        } else {
            if (!response.ok) {
                throw await handleApiError(response);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            
            if (!content) {
                throw new Error('OpenRouter API가 빈 응답을 반환했습니다.');
            }

            return content;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('요청이 취소되었습니다.');
        }
        throw error;
    }
}

