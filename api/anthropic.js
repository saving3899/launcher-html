/**
 * Anthropic (Claude) API 통신 모듈
 * 실리태번 방식 참고, 클라이언트 사이드에서 직접 호출
 */


const ANTHROPIC_API_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Anthropic API 호출
 * @param {object} options - API 옵션
 * @param {string} options.apiKey - API 키
 * @param {string} options.model - 모델 이름
 * @param {Array} options.messages - 메시지 배열 [{ role, content }]
 * @param {number} options.temperature - 온도 (0-1)
 * @param {number} options.maxTokens - 최대 토큰 수
 * @param {Array<string>} options.stopSequences - 정지 시퀀스
 * @param {boolean} options.stream - 스트리밍 여부
 * @param {AbortSignal} options.signal - 취소 신호
 * @param {Function} options.onChunk - 스트리밍 청크 콜백
 * @param {Array} options.system - 시스템 프롬프트 (선택사항)
 * @param {string} options.reasoningEffort - Reasoning effort ('auto', 'min', 'low', 'medium', 'high', 'max')
 * @param {number} options.cachingAtDepth - 캐싱할 깊이 (-1이면 비활성화, 0 이상이면 활성화)
 * @param {boolean} options.enableSystemPromptCache - 시스템 프롬프트 캐싱 활성화
 * @param {boolean} options.extendedTTL - 캐시 TTL 연장 (false면 5m, true면 1h)
 * @param {boolean} options.enableWebSearch - 웹 검색 활성화
 * @param {boolean} options.useSysprompt - 시스템 프롬프트 사용
 * @returns {Promise<string>} 응답 텍스트
 */
async function callAnthropic({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stopSequences = [],
    stream = false,
    signal = null,
    onChunk = null,
    system = null,
    reasoningEffort = 'auto',
    cachingAtDepth = -1,
    enableSystemPromptCache = false,
    extendedTTL = false,
    enableWebSearch = false,
    useSysprompt = false,
}) {
    if (!apiKey) {
        throw new Error('Anthropic API 키가 필요합니다.');
    }

    // 메시지 필터링 및 변환
    const filteredMessages = messages
        .filter(msg => msg && typeof msg === 'object')
        .map(msg => {
            // Anthropic 형식으로 변환
            if (typeof msg.content === 'string') {
                return {
                    role: msg.role,
                    content: msg.content,
                };
            }
            return msg;
        });

    // 토큰 최적화 적용 (tokenOptimization 유틸리티 사용)
    let optimizationOptions = {};
    if (typeof window !== 'undefined' && window.tokenOptimization) {
        optimizationOptions = window.tokenOptimization.getTokenOptimizationOptions();
    }
    
    const actualCachingAtDepth = cachingAtDepth >= 0 ? cachingAtDepth : (optimizationOptions.cachingAtDepth || -1);
    const actualEnableSystemPromptCache = enableSystemPromptCache || (optimizationOptions.enableSystemPromptCache || false);
    const actualExtendedTTL = extendedTTL || (optimizationOptions.extendedTTL || false);
    const cacheTTL = actualExtendedTTL ? '1h' : '5m';

    // 깊이별 캐싱 적용
    if (actualCachingAtDepth >= 0 && window.tokenOptimization) {
        window.tokenOptimization.cachingAtDepthForClaude(filteredMessages, actualCachingAtDepth, cacheTTL);
    }

    // 시스템 프롬프트 캐싱 적용
    let processedSystem = system;
    if (actualEnableSystemPromptCache && Array.isArray(system) && system.length > 0 && window.tokenOptimization) {
        // system 배열 복사 (원본 수정 방지)
        processedSystem = JSON.parse(JSON.stringify(system));
        window.tokenOptimization.addSystemPromptCache(processedSystem, cacheTTL);
    }

    const requestBody = {
        model: model,
        messages: filteredMessages,
        max_tokens: maxTokens,
        temperature: temperature,
        stream: stream,
    };

    // 선택적 필드 추가
    if (Array.isArray(stopSequences) && stopSequences.length > 0) {
        requestBody.stop_sequences = stopSequences;
    }

    // 실리태번과 동일: useSysprompt 처리 (156, 180-188번 라인)
    // useSysprompt가 true일 때만 system을 requestBody에 추가
    if (useSysprompt && Array.isArray(processedSystem) && processedSystem.length > 0) {
        requestBody.system = processedSystem;
    } else if (!useSysprompt) {
        // useSysprompt가 false면 system을 제거 (실리태번과 동일)
        delete requestBody.system;
    }

    // 실리태번과 동일: 웹 검색 활성화 (213-219번 라인)
    // Claude 3.5, 3.7, Opus-4, Sonnet-4, Haiku-4.5 모델에서만 지원
    const useWebSearch = /^claude-(3-5|3-7|opus-4|sonnet-4|haiku-4-5)/.test(model) && enableWebSearch;
    if (useWebSearch) {
        const webSearchTool = [{
            'type': 'web_search_20250305',
            'name': 'web_search',
        }];
        requestBody.tools = [...webSearchTool, ...(requestBody.tools || [])];
    }

    // Reasoning effort 및 토큰 예산 계산
    const useThinking = /^claude-(3-7|opus-4|sonnet-4|haiku-4-5)/.test(model);
    if (useThinking && window.tokenOptimization) {
        const budgetTokens = window.tokenOptimization.calculateClaudeBudgetTokens(maxTokens, reasoningEffort, stream);
        
        if (Number.isInteger(budgetTokens)) {
            // 최소 thinking 토큰 확인
            const minThinkTokens = 1024;
            if (requestBody.max_tokens <= minThinkTokens) {
                requestBody.max_tokens = requestBody.max_tokens + minThinkTokens;
            }
            
            requestBody.thinking = {
                type: 'enabled',
                budget_tokens: budgetTokens,
            };
            
            // Thinking 모드에서는 temperature/top_p 제거
            delete requestBody.temperature;
        }
    }

    // 캐싱 활성화 시 필요한 헤더 추가
    const additionalHeaders = {};
    if (actualEnableSystemPromptCache || actualCachingAtDepth >= 0) {
        additionalHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11';
    }

    // Anthropic은 기본적으로 세이프티 필터가 없음 (API 파라미터가 없음)

    const url = `${ANTHROPIC_API_BASE_URL}/messages`;

    try {
        const headers = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': apiKey,
            'anthropic-dangerous-direct-browser-access': 'true', // 브라우저에서 직접 접근 허용
            ...additionalHeaders,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: signal,
        });

        if (stream) {
            // 스트리밍 응답 처리 (Anthropic SSE 형식)
            return await parseStreamingResponse(response, 'anthropic', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10018', 'Anthropic 스트리밍 오류', error);
                    }
                    throw error;
                },
            });
        } else {
            // 비스트리밍 응답 처리
            if (!response.ok) {
                throw await handleApiError(response);
            }

            const data = await response.json();
            const content = data.content;
            
            if (!content || !Array.isArray(content) || content.length === 0) {
                throw new Error('Anthropic API가 빈 응답을 반환했습니다.');
            }

            // Anthropic은 content가 배열로 반환됨 (대부분 text 타입)
            const textContent = content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');

            if (!textContent) {
                throw new Error('Anthropic API 응답에 텍스트가 없습니다.');
            }

            return textContent;
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('요청이 취소되었습니다.');
        }
        throw error;
    }
}

