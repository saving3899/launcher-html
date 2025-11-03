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
}) {
    if (!apiKey) {
        throw new Error('OpenRouter API 키가 필요합니다.');
    }

    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        model: model,
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop;
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

