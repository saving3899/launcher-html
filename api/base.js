/**
 * AI API 통신 모듈 - 공통 인터페이스 및 유틸리티
 * 실리태번 방식 참고
 */

/**
 * Google Gemini 세이프티 세팅 (완전 비활성화)
 * 실리태번 GEMINI_SAFETY 상수와 동일
 */
const GEMINI_SAFETY = [
    {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'OFF',
    },
    {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'OFF',
    },
    {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'OFF',
    },
    {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'OFF',
    },
    {
        category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
        threshold: 'OFF',
    },
];

/**
 * API 소스 타입 (실리태번 CHAT_COMPLETION_SOURCES와 동일)
 */
const API_SOURCES = {
    OPENAI: 'openai',
    CLAUDE: 'claude',
    OPENROUTER: 'openrouter',
    AI21: 'ai21',
    MAKERSUITE: 'makersuite',
    VERTEXAI: 'vertexai',
    MISTRALAI: 'mistralai',
    CUSTOM: 'custom',
    COHERE: 'cohere',
    PERPLEXITY: 'perplexity',
    GROQ: 'groq',
    ELECTRONHUB: 'electronhub',
    NANOGPT: 'nanogpt',
    DEEPSEEK: 'deepseek',
    AIMLAPI: 'aimlapi',
    XAI: 'xai',
    POLLINATIONS: 'pollinations',
    MOONSHOT: 'moonshot',
    FIREWORKS: 'fireworks',
    COMETAPI: 'cometapi',
    AZURE_OPENAI: 'azure_openai',
    ZAI: 'zai',
};

/**
 * 스트리밍 응답 파싱 (Server-Sent Events)
 * @param {Response} response - fetch 응답
 * @param {string} apiSource - API 소스 ('openai', 'anthropic', 'gemini')
 * @param {Function} onChunk - 청크 수신 콜백 (text: string) => void
 * @param {Function} onDone - 완료 콜백 (fullText: string) => void
 * @param {Function} onError - 에러 콜백 (error: Error) => void
 * @returns {Promise<string>} 전체 응답 텍스트
 */
async function parseStreamingResponse(response, apiSource, { onChunk, onDone, onError, signal } = {}) {
    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`API 요청 실패: ${response.status} ${response.statusText}\n${errorText}`);
        if (onError) onError(error);
        throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
        while (true) {
            // signal이 aborted 상태면 즉시 중단
            if (signal?.aborted) {
                throw new DOMException('The operation was aborted.', 'AbortError');
            }
            
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }

            // 읽은 후에도 signal 체크 (비동기 작업 중간에 abort될 수 있음)
            if (signal?.aborted) {
                throw new DOMException('The operation was aborted.', 'AbortError');
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 마지막 불완전한 줄은 버퍼에 보관

            for (const line of lines) {
                if (line.trim() === '') continue;
                
                // 각 줄 처리 전에도 signal 체크
                if (signal?.aborted) {
                    throw new DOMException('The operation was aborted.', 'AbortError');
                }
                
                // SSE 형식: "data: {...}"
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        if (onDone) onDone(fullText);
                        return fullText;
                    }
                    
                    try {
                        const json = JSON.parse(data);
                        const text = extractTextFromChunk(json, apiSource);
                        if (text) {
                            fullText += text;
                            if (onChunk) {
                                // onChunk 호출 전에도 signal 체크 (onChunk에서 throw할 수 있지만 여기서도 체크)
                                if (signal?.aborted) {
                                    throw new DOMException('The operation was aborted.', 'AbortError');
                                }
                                // text와 함께 원본 json 데이터도 전달 (추론 내용 추출용)
                                onChunk(text, json);
                            }
                        } else {
                            // 텍스트가 없어도 추론 내용이 있을 수 있으므로 json 전달
                            if (onChunk) {
                                if (signal?.aborted) {
                                    throw new DOMException('The operation was aborted.', 'AbortError');
                                }
                                onChunk('', json);
                            }
                        }
                    } catch (e) {
                        // AbortError는 상위로 전파
                        if (e.name === 'AbortError' || e instanceof DOMException) {
                            throw e;
                        }
                        // JSON 파싱 오류 무시 (일부 청크는 불완전할 수 있음)
                        // 경고 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('WARN_API_20004', '스트리밍 청크 파싱 오류');
                        }
                    }
                }
            }
        }

        if (onDone) onDone(fullText);
        return fullText;
    } catch (error) {
        if (onError) onError(error);
        throw error;
    } finally {
        reader.releaseLock();
    }
}

/**
 * 스트리밍 청크에서 텍스트 추출 (API별로 다른 구조)
 * @param {object} chunk - 청크 JSON 객체
 * @param {string} apiSource - API 소스
 * @returns {string|null} 추출된 텍스트 또는 null
 */
function extractTextFromChunk(chunk, apiSource) {
    if (apiSource === 'openai') {
        // OpenAI 형식: { choices: [{ delta: { content: "..." } }] }
        // 추론 내용(reasoning_content, reasoning)은 별도 필드이므로 content에서 제외됨
        if (chunk.choices?.[0]?.delta?.content) {
            return chunk.choices[0].delta.content;
        }
    } else if (apiSource === 'anthropic') {
        // Anthropic 형식: { type: 'content_block_delta', delta: { text: "..." } }
        // thinking은 별도 이벤트로 오므로 text에는 포함되지 않음
        // thinking 이벤트는 텍스트가 아니므로 null 반환
        if (chunk.type === 'content_block_delta' && chunk.delta?.thinking) {
            return null; // thinking은 추론으로 별도 처리, 텍스트 반환하지 않음
        }
        // text 델타는 텍스트로 반환
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            return chunk.delta.text;
        }
        // 또는: { type: 'content_block', content: { text: "..." } }
        if (chunk.type === 'content_block' && chunk.content?.text) {
            return chunk.content.text;
        }
        // thinking 콘텐츠 블록은 텍스트가 아니므로 null 반환
        if (chunk.type === 'content_block' && chunk.content?.type === 'thinking') {
            return null; // thinking은 추론으로 별도 처리
        }
    } else if (apiSource === 'gemini') {
        // Google Gemini 형식: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
        if (chunk.candidates?.[0]?.content?.parts) {
            return chunk.candidates[0].content.parts
                .filter(part => part.text && !part.thought) // thought 제외
                .map(part => part.text)
                .join('');
        }
    } else if (apiSource === 'cohere') {
        // Cohere 형식: { delta: { message: { content: { text: "..." } } } }
        return chunk?.delta?.message?.content?.text || chunk?.delta?.message?.tool_plan || '';
    }

    return null;
}

/**
 * API 에러 처리
 * @param {Response} response - fetch 응답
 * @returns {Promise<Error>} 에러 객체
 */
async function handleApiError(response) {
    let errorMessage = `API 요청 실패: ${response.status} ${response.statusText}`;
    
    try {
        const errorText = await response.text();
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
            errorMessage += `\n${errorJson.error.message}`;
        } else if (typeof errorJson.error === 'string') {
            errorMessage += `\n${errorJson.error}`;
        } else {
            errorMessage += `\n${errorText}`;
        }
    } catch (e) {
        // JSON 파싱 실패 시 원본 텍스트 사용
    }
    
    return new Error(errorMessage);
}

/**
 * 프록시를 통한 API 호출 (CORS 문제 해결)
 * @param {string} targetUrl - 실제 API 엔드포인트 URL
 * @param {object} options - fetch 옵션
 * @param {string} proxyUrl - 프록시 서버 URL (선택사항)
 * @returns {Promise<Response>}
 */
async function fetchWithProxy(targetUrl, options = {}, proxyUrl = null) {
    // 프록시 URL이 없으면 직접 호출
    if (!proxyUrl || !proxyUrl.trim()) {
        return await fetch(targetUrl, options);
    }

    const proxyUrlTrimmed = proxyUrl.trim();
    
    // 공개 CORS 프록시 서비스 형식 (예: https://corsproxy.io/?)
    if (proxyUrlTrimmed.endsWith('?') || proxyUrlTrimmed.endsWith('/?') || proxyUrlTrimmed.includes('corsproxy.io') || proxyUrlTrimmed.includes('allorigins.win')) {
        const encodedUrl = encodeURIComponent(targetUrl);
        const proxyEndpoint = proxyUrlTrimmed.endsWith('?') 
            ? `${proxyUrlTrimmed}${encodedUrl}`
            : `${proxyUrlTrimmed}?${encodedUrl}`;
        
        return await fetch(proxyEndpoint, {
            method: options.method || 'POST',
            headers: {
                ...options.headers,
                // CORS 프록시는 일부 헤더를 제거할 수 있으므로 필수 헤더만 유지
            },
            body: options.body,
            signal: options.signal,
        });
    }
    
    // 자체 프록시 서버 형식 (Vercel Functions, Cloudflare Workers 등)
    // 프록시 서버에 요청 데이터 전달
    const proxyBody = {
        url: targetUrl,
        method: options.method || 'POST',
        headers: options.headers || {},
        body: options.body ? JSON.parse(options.body) : undefined,
    };
    
    return await fetch(proxyUrlTrimmed, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyBody),
        signal: options.signal,
    });
}

