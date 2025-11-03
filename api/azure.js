/**
 * Azure OpenAI API 통신 모듈
 * 실리태번 방식 참고
 */


/**
 * Azure OpenAI API 호출
 * Azure OpenAI는 특별한 URL 형식과 헤더를 사용
 * URL: {base_url}/openai/deployments/{deployment_name}/chat/completions?api-version={api_version}
 * 헤더: api-key (Authorization Bearer가 아님!)
 */
async function callAzureOpenAI({
    apiKey,
    azureBaseUrl,
    azureDeploymentName,
    azureApiVersion,
    model, // Azure에서는 deployment_name을 사용하지만, 응답에 실제 model이 포함될 수 있음
    messages,
    temperature = 1.0,
    maxTokens = 2048,
    stop = [],
    stream = false,
    signal = null,
    onChunk = null,
}) {
    if (!apiKey || !azureBaseUrl || !azureDeploymentName || !azureApiVersion) {
        throw new Error('Azure OpenAI 설정이 완전하지 않습니다. Base URL, Deployment Name, API Version, API Key가 모두 필요합니다.');
    }

    const filteredMessages = messages.filter(msg => msg && typeof msg === 'object');

    const requestBody = {
        messages: filteredMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: stream,
    };

    // Azure OpenAI는 model 필드를 사용하지 않고 deployment_name을 사용하지만,
    // 일부 파라미터는 모델에 따라 다를 수 있음
    // 실리태번에서는 model을 requestBody에 포함시키지 않음

    if (Array.isArray(stop) && stop.length > 0) {
        requestBody.stop = stop;
    }

    // Azure OpenAI 엔드포인트 구성 (실리태번 방식)
    const url = new URL(`/openai/deployments/${azureDeploymentName}/chat/completions`, azureBaseUrl);
    url.searchParams.set('api-version', azureApiVersion);
    const endpointUrl = url.toString();

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey, // Azure는 api-key 헤더 사용 (Bearer가 아님!)
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
                        showErrorCodeToast('ERR_API_10023', 'Azure OpenAI 스트리밍 오류', error);
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
                throw new Error('Azure OpenAI API가 빈 응답을 반환했습니다.');
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

