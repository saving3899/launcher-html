/**
 * AI API 통신 모듈 - 통합 인터페이스
 * 모든 API를 통합하여 사용하는 메인 엔트리 포인트
 */


/**
 * 통합 API 호출 함수
 * @param {object} options - API 옵션
 * @param {string} options.apiSource - API 소스 ('openai', 'anthropic', 'gemini')
 * @param {string} options.apiKey - API 키
 * @param {string} options.model - 모델 이름
 * @param {Array} options.messages - 메시지 배열 [{ role, content }]
 * @param {number} options.temperature - 온도
 * @param {number} options.maxTokens - 최대 토큰 수
 * @param {Array<string>} options.stop - 정지 시퀀스 (API별로 필드명 다를 수 있음)
 * @param {boolean} options.stream - 스트리밍 여부
 * @param {AbortSignal} options.signal - 취소 신호
 * @param {Function} options.onChunk - 스트리밍 청크 콜백
 * @param {object} options.systemInstruction - 시스템 인스트럭션 (API별로 다를 수 있음)
 * @param {string} options.azureBaseUrl - Azure OpenAI Base URL (Azure OpenAI만)
 * @param {string} options.azureDeploymentName - Azure OpenAI Deployment Name (Azure OpenAI만)
 * @param {string} options.azureApiVersion - Azure OpenAI API Version (Azure OpenAI만)
 * @param {string} options.customUrl - Custom API URL (Custom API만)
 * @param {string} options.proxyUrl - 프록시 서버 URL (CORS 문제 해결용, 선택사항)
 * @param {string} options.vertexaiAuthMode - Vertex AI 인증 모드 ('express' 또는 'full')
 * @param {string} options.vertexaiRegion - Vertex AI Region (기본값: 'us-central1')
 * @param {string} options.vertexaiProjectId - Vertex AI Project ID (선택사항)
 * @param {string|object} options.vertexaiServiceAccountJson - Vertex AI Service Account JSON (Full 모드만 필요)
 * @returns {Promise<string>} 응답 텍스트
 */
async function callAI({
    apiSource,
    apiKey,
    model,
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
    systemInstruction = null,
    azureBaseUrl = null,
    azureDeploymentName = null,
    azureApiVersion = null,
    customUrl = null,
    proxyUrl = null, // 프록시 URL 추가
    vertexaiAuthMode = 'express',
    vertexaiRegion = 'us-central1',
    vertexaiProjectId = null,
    vertexaiServiceAccountJson = null,
}) {
    if (!apiSource) {
        throw new Error(`API 소스가 지정되지 않았습니다.`);
    }

    const source = apiSource.toLowerCase();

    try {
        switch (source) {
            case 'openai':
                return await callOpenAI({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                    proxyUrl,
                });

            case 'claude':
            case 'anthropic':
                return await callAnthropic({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stopSequences: stop,
                    stream,
                    signal,
                    onChunk,
                    system: systemInstruction,
                });

            case 'makersuite':
            case 'gemini':
            case 'google':
                return await callGemini({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stopSequences: stop,
                    stream,
                    signal,
                    onChunk,
                    systemInstruction,
                });

            case 'vertexai':
                // Vertex AI Express 모드와 Full 모드 모두 지원
                // Full 모드는 Web Crypto API를 사용하여 브라우저에서도 가능
                return await callVertexAI({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stopSequences: stop,
                    stream,
                    signal,
                    onChunk,
                    systemInstruction,
                    authMode: vertexaiAuthMode || 'express',
                    region: vertexaiRegion || 'us-central1',
                    projectId: vertexaiProjectId || null,
                    serviceAccountJson: vertexaiServiceAccountJson || null,
                });

            case 'openrouter':
                return await callOpenRouter({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'mistralai':
            case 'mistral':
                return await callMistral({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'cohere':
                return await callCohere({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'perplexity':
                return await callPerplexity({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'groq':
                return await callGroq({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'deepseek':
                return await callDeepSeek({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'xai':
                return await callXAI({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'moonshot':
                return await callMoonshot({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'fireworks':
                return await callFireworks({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'aimlapi':
                return await callAimlapi({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'electronhub':
                return await callElectronHub({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'nanogpt':
                return await callNanoGPT({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'pollinations':
                return await callPollinations({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'zai':
                return await callZai({
                    apiKey,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'azure_openai':
                if (!azureBaseUrl || !azureDeploymentName || !azureApiVersion) {
                    throw new Error('Azure OpenAI 설정이 완전하지 않습니다. Base URL, Deployment Name, API Version이 모두 필요합니다.');
                }
                return await callAzureOpenAI({
                    apiKey,
                    azureBaseUrl,
                    azureDeploymentName,
                    azureApiVersion,
                    model, // Azure에서는 deployment_name을 사용하지만 model도 전달
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'custom':
                if (!customUrl) {
                    throw new Error('Custom API URL이 필요합니다.');
                }
                return await callCustom({
                    apiKey,
                    customUrl,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    stop,
                    stream,
                    signal,
                    onChunk,
                });

            case 'ai21':
            case 'cometapi':
                // 아직 미구현
                throw new Error(`현재 ${source} API는 아직 지원되지 않습니다.`);

            default:
                throw new Error(`지원하지 않는 API 제공업체: ${source}`);
        }
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_API_10024', `AI API 호출 오류 (${apiSource})`, error);
        }
        throw error;
    }
}

// 재내보내기








