/**
 * Groq API 통신 모듈
 * 실리태번 방식 참고
 */


const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Groq API 호출
 * Groq는 OpenAI 호환 API이지만 system 메시지를 user로 변환해야 함
 */
async function callGroq({
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
        throw new Error('Groq API 키가 필요합니다.');
    }

    // Groq는 system 메시지를 user로 변환 (실리태번 참고)
    const convertedMessages = messages
        .filter(msg => msg && typeof msg === 'object')
        .map(msg => {
            if (msg.role === 'system') {
                return {
                    role: 'user',
                    content: msg.content,
                };
            }
            return msg;
        });

    const requestBody = {
        model: model,
        messages: convertedMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop;
    }

    // Groq는 logprobs, logit_bias를 지원하지 않음

    const url = `${GROQ_API_BASE_URL}/chat/completions`;

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
                        showErrorCodeToast('ERR_API_10012', 'Groq 스트리밍 오류', error);
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
                throw new Error('Groq API가 빈 응답을 반환했습니다.');
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

