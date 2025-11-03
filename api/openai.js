/**
 * OpenAI API 통신 모듈
 * 실리태번 방식 참고, 클라이언트 사이드에서 직접 호출
 */


const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

/**
 * OpenAI API 호출
 * @param {object} options - API 옵션
 * @param {string} options.apiKey - API 키
 * @param {string} options.model - 모델 이름
 * @param {Array} options.messages - 메시지 배열 [{ role, content }]
 * @param {number} options.temperature - 온도 (0-2)
 * @param {number} options.maxTokens - 최대 토큰 수
 * @param {Array<string>} options.stop - 정지 시퀀스
 * @param {boolean} options.stream - 스트리밍 여부
 * @param {AbortSignal} options.signal - 취소 신호
 * @param {Function} options.onChunk - 스트리밍 청크 콜백
 * @returns {Promise<string>} 응답 텍스트
 */
async function callOpenAI({
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
    proxyUrl = null, // 프록시 URL (선택사항)
}) {
    if (!apiKey) {
        throw new Error('OpenAI API 키가 필요합니다.');
    }

    // 메시지 필터링 (null 및 비객체 제거)
    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        model: model,
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    // 선택적 필드 추가
    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop;
    }

    // 세이프티 세팅: OpenAI는 기본적으로 모더레이션 검사가 없지만,
    // 명시적으로 제거할 수 있는 파라미터는 없음 (OpenAI API에는 세이프티 파라미터가 없음)

    const url = `${OPENAI_API_BASE_URL}/chat/completions`;

    try {
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: signal,
        }, proxyUrl);

        if (stream) {
            // 스트리밍 응답 처리
            return await parseStreamingResponse(response, 'openai', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10006', 'OpenAI 스트리밍 오류', error);
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
            const content = data.choices?.[0]?.message?.content;
            
            if (!content) {
                throw new Error('OpenAI API가 빈 응답을 반환했습니다.');
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

