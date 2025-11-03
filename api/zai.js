/**
 * Z.AI API 통신 모듈
 * 실리태번 방식 참고
 */


const ZAI_API_BASE_URL = 'https://api.z.ai/api/paas/v4';

/**
 * Z.AI API 호출
 */
async function callZai({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
    includeReasoning = false,
}) {
    if (!apiKey) {
        throw new Error('Z.AI API 키가 필요합니다.');
    }

    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        model: model,
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
        thinking: {
            type: includeReasoning ? 'enabled' : 'disabled',
        },
    };

    // Z.AI는 stop을 최대 1개만 지원
    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop.slice(0, 1);
    }

    const url = `${ZAI_API_BASE_URL}/chat/completions`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept-Language': 'en-US,en',
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
                        showErrorCodeToast('ERR_API_10007', 'Z.AI 스트리밍 오류', error);
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
                throw new Error('Z.AI API가 빈 응답을 반환했습니다.');
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

