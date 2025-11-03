/**
 * Cohere API 통신 모듈
 * 실리태번 방식 참고
 */


const COHERE_API_BASE_URL = 'https://api.cohere.ai/v2';

/**
 * Cohere API 호출
 * Cohere는 다른 엔드포인트와 메시지 형식을 사용
 */
async function callCohere({
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
        throw new Error('Cohere API 키가 필요합니다.');
    }

    // Cohere 메시지 변환 (실리태번 convertCohereMessages 참고)
    const convertedMessages = convertCohereMessages(messages);

    const requestBody = {
        model: model,
        chat_history: convertedMessages.slice(0, -1), // 마지막 메시지 제외
        message: convertedMessages[convertedMessages.length - 1]?.message || '',
        temperature: Math.min(Math.max(temperature, 0.01), 0.99), // 0.01 -> 0.99로 클램프
        max_tokens: maxTokens,
        stream: stream,
    };

    if (Array.isArray(stop) && stop.length > 0 && stop.length <= 5) {
        requestBody.stop_sequences = stop;
    }

    const url = `${COHERE_API_BASE_URL}/chat`;

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
            return await parseStreamingResponse(response, 'cohere', {
                onChunk: onChunk,
                onError: (error) => {
                    // 오류 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('ERR_API_10017', 'Cohere 스트리밍 오류', error);
                    }
                    throw error;
                },
            });
        } else {
            if (!response.ok) {
                throw await handleApiError(response);
            }

            const data = await response.json();
            const content = data.message?.content?.text || data.message?.content;
            
            if (!content) {
                throw new Error('Cohere API가 빈 응답을 반환했습니다.');
            }

            return typeof content === 'string' ? content : content.text || '';
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('요청이 취소되었습니다.');
        }
        throw error;
    }
}

/**
 * Cohere 메시지 형식으로 변환
 */
function convertCohereMessages(messages) {
    return messages
        .filter(msg => msg && typeof msg === 'object')
        .map(msg => {
            const role = msg.role === 'assistant' ? 'CHATBOT' : 'USER';
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            return {
                role: role,
                message: content,
            };
        });
}

