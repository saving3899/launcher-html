/**
 * xAI (Grok) API 통신 모듈
 * 실리태번 방식 참고
 */


const XAI_API_BASE_URL = 'https://api.x.ai/v1';

/**
 * xAI API 호출
 * xAI는 OpenAI 호환이지만 메시지 변환이 필요할 수 있음
 * @param {boolean} options.enableWebSearch - 웹 검색 활성화
 */
async function callXAI({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
    enableWebSearch = false,
}) {
    if (!apiKey) {
        throw new Error('xAI API 키가 필요합니다.');
    }

    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        model: model,
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    // 일부 모델은 stop을 지원하지 않음 (실리태번 참고)
    const modelName = model || '';
    if (Array.isArray(stop) && stop.length > 0) {
        if (!modelName.includes('grok-3-mini') && !modelName.includes('grok-4-fast-non-reasoning')) {
            requestBody.stop = stop;
        }
    }

    // 일부 모델은 penalty를 지원하지 않음
    if (modelName.includes('grok-3-mini') || modelName.includes('grok-4') || modelName.includes('grok-code')) {
        // penalty는 추가하지 않음
    } else {
        // 다른 모델들은 기본 파라미터 사용
    }

    // 실리태번과 동일: 웹 검색 활성화 (1005-1014번 라인)
    if (enableWebSearch) {
        requestBody.search_parameters = {
            mode: 'on',
            sources: [
                { type: 'web', safe_search: false },
                { type: 'news', safe_search: false },
                { type: 'x' },
            ],
        };
    }

    const url = `${XAI_API_BASE_URL}/chat/completions`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
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
                        showErrorCodeToast('ERR_API_10014', 'xAI 스트리밍 오류', error);
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
                throw new Error('xAI API가 빈 응답을 반환했습니다.');
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

