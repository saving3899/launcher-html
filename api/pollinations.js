/**
 * Pollinations API 통신 모듈
 * 실리태번 방식 참고
 */


const POLLINATIONS_API_BASE_URL = 'https://text.pollinations.ai/openai';

/**
 * Pollinations API 호출
 * Pollinations는 API 키가 없고 Authorization 헤더를 빈 문자열로 설정
 */
async function callPollinations({
    apiKey, // 사용되지 않음
    model,
    messages,
    temperature = 1.0,
    maxTokens = undefined, // Pollinations는 max_tokens를 지원하지 않음
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
}) {
    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        model: model,
        messages: filteredMessages,
        temperature: temperature,
        stream: stream,
        private: true,
        referrer: 'sillytavern',
        seed: Math.floor(Math.random() * 99999999),
    };

    // Pollinations는 max_tokens를 지원하지 않음
    // stop도 지원하지 않을 수 있음

    const url = `${POLLINATIONS_API_BASE_URL}/chat/completions`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': '', // 빈 문자열
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
                        showErrorCodeToast('ERR_API_10009', 'Pollinations 스트리밍 오류', error);
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
                throw new Error('Pollinations API가 빈 응답을 반환했습니다.');
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

