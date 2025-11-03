/**
 * Custom API 통신 모듈
 * 실리태번 방식 참고
 */


/**
 * Custom API 호출
 * 사용자 지정 URL을 사용하는 OpenAI 호환 API
 */
async function callCustom({
    apiKey,
    customUrl,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
}) {
    if (!customUrl) {
        throw new Error('Custom API URL이 필요합니다.');
    }

    // Custom API는 API 키가 필수는 아닐 수 있음 (서버 설정에 따라)
    // 하지만 대부분의 경우 필요

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

    // Custom API URL 구성 (실리태번 방식)
    const url = `${customUrl.replace(/\/$/, '')}/chat/completions`;

    const headers = {
        'Content-Type': 'application/json',
    };

    // API 키가 있으면 추가
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: signal,
        });

        if (stream) {
            return await parseStreamingResponse(response, 'openai', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10025', 'Custom API 스트리밍 오류', error);
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
                throw new Error('Custom API가 빈 응답을 반환했습니다.');
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

