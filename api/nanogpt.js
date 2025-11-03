/**
 * NanoGPT API 통신 모듈
 * 실리태번 방식 참고
 */


const NANOGPT_API_BASE_URL = 'https://nano-gpt.com/api/v1';

/**
 * NanoGPT API 호출
 */
async function callNanoGPT({
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
        throw new Error('NanoGPT API 키가 필요합니다.');
    }

    // 웹 검색 활성화 시 모델명에 :online 추가
    let actualModel = model;
    if (enableWebSearch && !/:online$/.test(model)) {
        actualModel = `${model}:online`;
    }

    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        model: actualModel,
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop;
    }

    const url = `${NANOGPT_API_BASE_URL}/chat/completions`;

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
                        showErrorCodeToast('ERR_API_10010', 'NanoGPT 스트리밍 오류', error);
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
                throw new Error('NanoGPT API가 빈 응답을 반환했습니다.');
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

