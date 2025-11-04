/**
 * 정확한 토큰 카운팅 모듈
 * tiktoken을 사용하여 한글과 영어를 포함한 모든 언어의 토큰을 정확하게 계산
 */

// tiktoken 캐시 (모델별 인코더)
const tokenizerCache = new Map();

/**
 * 모델 이름을 기반으로 tiktoken 인코더 가져오기
 * @param {string} model - 모델 이름 (예: 'gpt-3.5-turbo', 'gpt-4')
 * @returns {Promise<any>} tiktoken 인코더
 */
async function getTokenizer(model = 'gpt-3.5-turbo') {
    // 캐시 확인
    if (tokenizerCache.has(model)) {
        return tokenizerCache.get(model);
    }

    try {
        // js-tiktoken 모듈 동적 import 시도
        // js-tiktoken은 브라우저에서 직접 사용 가능한 JavaScript 구현
        let jsTiktoken;
        
        try {
            // js-tiktoken 패키지 import (브라우저에서 직접 사용 가능)
            jsTiktoken = await import('https://cdn.jsdelivr.net/npm/js-tiktoken@1.0.21/+esm');
        } catch (importError) {
            // import 실패 시 추정 방식으로 폴백
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_TOKEN_15002', 'js-tiktoken 모듈 로드 실패', importError);
            }
            return null;
        }
        
        let encoding;
        
        try {
            // 모델명을 기반으로 적절한 인코딩 선택
            let encodingName = 'cl100k_base'; // 기본값 (gpt-3.5-turbo, gpt-4)
            
            if (model.includes('gpt-4') || model.includes('gpt-3.5-turbo') || model.includes('gpt-35-turbo')) {
                encodingName = 'cl100k_base';
            } else if (model.includes('text-davinci')) {
                encodingName = 'p50k_base';
            } else if (model.includes('text-curie') || model.includes('text-babbage') || model.includes('text-ada')) {
                encodingName = 'r50k_base';
            }
            
            // js-tiktoken에서 인코딩 가져오기 (여러 방법 시도)
            // js-tiktoken의 기본 export가 함수일 수도 있고, 객체일 수도 있음
            const tiktokenModule = jsTiktoken.default || jsTiktoken;
            
            // js-tiktoken은 camelCase API를 사용합니다
            if (tiktokenModule && typeof tiktokenModule.encodingForModel === 'function') {
                // 방법 1: encodingForModel 사용 (권장, camelCase)
                encoding = tiktokenModule.encodingForModel(model);
            } else if (tiktokenModule && typeof tiktokenModule.getEncoding === 'function') {
                // 방법 2: getEncoding 사용 (camelCase)
                encoding = tiktokenModule.getEncoding(encodingName);
            } else if (typeof tiktokenModule === 'function') {
                // 방법 3: js-tiktoken이 함수인 경우 (예: createEncoding)
                encoding = tiktokenModule(encodingName);
            } else {
                // 사용 가능한 속성 확인
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_TOKEN_15003', 'js-tiktoken에서 인코딩 함수를 찾을 수 없음');
                }
                throw new Error('js-tiktoken에서 인코딩 함수를 찾을 수 없습니다.');
            }
        } catch (error) {
            // 모델명이 지원되지 않으면 기본 인코딩 사용
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_TOKEN_20001', `인코딩 "${model}" 로드 실패, 기본 인코딩 시도`);
            }
            try {
                const tiktokenModule = jsTiktoken.default || jsTiktoken;
                if (tiktokenModule && typeof tiktokenModule.getEncoding === 'function') {
                    encoding = tiktokenModule.getEncoding('cl100k_base');
                } else if (tiktokenModule && typeof tiktokenModule.encodingForModel === 'function') {
                    encoding = tiktokenModule.encodingForModel('gpt-3.5-turbo');
                } else if (typeof tiktokenModule === 'function') {
                    encoding = tiktokenModule('cl100k_base');
                } else {
                    throw new Error('기본 인코딩을 로드할 수 없습니다.');
                }
            } catch (e) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_TOKEN_15004', '기본 인코딩 로드 실패', e);
                }
                return null;
            }
        }
        
        if (!encoding) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_TOKEN_15005', '인코딩을 가져올 수 없음');
            }
            return null;
        }
        
        tokenizerCache.set(model, encoding);
        return encoding;
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_TOKEN_15006', 'js-tiktoken 초기화 실패', error);
            showErrorCodeToast('WARN_TOKEN_20002', 'js-tiktoken을 사용할 수 없어 추정 방식으로 전환');
        }
        // 폴백: null 반환하여 추정 방식 사용
        return null;
    }
}

/**
 * 메시지 배열의 토큰 수 계산 (OpenAI Chat Completion 형식)
 * @param {Array|Object} messages - 메시지 배열 또는 단일 메시지
 * @param {string} model - 모델 이름 (기본값: 'gpt-3.5-turbo')
 * @param {boolean} full - 전체 토큰 수 계산 여부 (기본값: false)
 * @returns {Promise<number>} 토큰 수
 */
async function countTokens(messages, model = 'gpt-3.5-turbo', full = false) {
    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
        return 0;
    }

    // 단순 문자열인 경우 (메시지 형식이 아닌 경우)
    // 실리태번의 counterWrapperOpenAIAsync는 단순 문자열을 메시지 형식으로 변환하여 계산:
    // { role: 'system', content: text } -> countTokensOpenAIAsync(message, true)
    if (typeof messages === 'string') {
        // 실리태번 방식: 메시지 형식으로 변환하여 계산
        const message = { role: 'system', content: messages };
        // full=true로 계산 (counterWrapperOpenAIAsync 참고)
        return await countTokens(message, model, true);
    }

    // 단일 메시지인 경우 배열로 변환
    const messageArray = Array.isArray(messages) ? messages : [messages];

    try {
        const encoding = await getTokenizer(model);
        
        if (!encoding) {
            // tiktoken을 사용할 수 없으면 개선된 추정 방식 사용
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_TOKEN_20003', 'tiktoken을 사용할 수 없어 추정 방식 사용');
            }
            return estimateTokens(messageArray, full, model);
        }

        // OpenAI Chat Completion 형식의 토큰 계산
        // 실리태번 클라이언트는 각 메시지를 개별적으로 서버에 보냄: JSON.stringify([message])
        // 실리태번 서버 코드 (tokenizers.js):
        //   let num_tokens = 0;
        //   for (const msg of req.body) {  // req.body는 배열 [message]
        //       num_tokens += tokensPerMessage;
        //       for (const [key, value] of Object.entries(msg)) {
        //           num_tokens += tokenizer.encode(value).length;
        //           if (key == 'name') {
        //               num_tokens += tokensPerName;
        //           }
        //       }
        //   }
        //   num_tokens += tokensPadding;  // 전체 배열에 대해 한 번만!
        //   if (queryModel.includes('gpt-3.5-turbo-0301')) {
        //       num_tokens += 9;  // 전체 배열에 대해 한 번만!
        //   }
        //
        // 클라이언트는 각 메시지를 [message] 형태로 보내므로,
        // 서버는 각 요청마다 단일 메시지 배열을 받아서 계산합니다.
        // 따라서 각 메시지마다 서버는:
        //   - tokensPerMessage 추가
        //   - 각 필드 value 인코딩
        //   - name이 있으면 tokensPerName 추가
        //   - tokensPadding 추가 (배열이 [message] 1개이므로, 1번만 추가되지만 각 요청마다 추가됨)
        //   - gpt-3.5-turbo-0301이면 9 추가 (각 요청마다)
        //
        // 클라이언트는: token_count = -1로 시작, 각 서버 결과를 합산
        // 마지막에: if (!full) token_count -= 2
        
        // 모델별 메시지당 토큰 수
        const tokensPerMessage = model.includes('gpt-3.5-turbo-0301') ? 4 : 3;
        const tokensPerName = model.includes('gpt-3.5-turbo-0301') ? -1 : 1;
        const tokensPadding = 3;
        
        // 실리태번 클라이언트 방식: 각 메시지를 개별적으로 서버에 보낸 것처럼 계산
        let tokenCount = -1; // 클라이언트는 -1로 시작
        
        for (let i = 0; i < messageArray.length; i++) {
            const message = messageArray[i];
            if (!message || typeof message !== 'object') continue;
            
            // 각 메시지의 서버 결과 계산 (서버는 [message] 배열을 받음)
            let messageTokens = 0; // 서버는 0으로 시작
            messageTokens += tokensPerMessage;
            
            let contentTokens = 0;
            // 실리태번 서버 코드 (tokenizers.js:996-1007):
            //   for (const msg of req.body) {
            //       try {
            //           num_tokens += tokensPerMessage;
            //           for (const [key, value] of Object.entries(msg)) {
            //               num_tokens += tokenizer.encode(value).length;
            //               if (key == 'name') {
            //                   num_tokens += tokensPerName;
            //               }
            //           }
            //       } catch {
            //           console.warn('Error tokenizing message:', msg);
            //       }
            //   }
            // 서버는 메시지 전체를 try-catch로 감싸고, 각 필드의 value를 그대로 encode합니다.
            // value가 문자열이 아니면 tokenizer.encode()가 에러를 발생시킬 수 있습니다.
            try {
                for (const [key, value] of Object.entries(message)) {
                    // 실리태번 서버는 value를 그대로 encode합니다
                    // 하지만 tiktoken의 encode는 문자열만 받으므로, 문자열이 아닌 경우 처리 필요
                    if (value === null || value === undefined) {
                        continue;
                    }
                    
                    // 실리태번 서버는 value를 그대로 encode하므로, 
                    // value가 배열이나 객체인 경우를 고려해야 합니다
                    let valueToEncode;
                    if (typeof value === 'string') {
                        valueToEncode = value;
                    } else if (Array.isArray(value)) {
                        // content가 배열인 경우 (multimodal, 예: [{type: "text", text: "..."}])
                        // 실리태번에서는 이런 경우를 어떻게 처리하는지 확인 필요
                        // 일단 JSON.stringify로 변환하여 계산
                        valueToEncode = JSON.stringify(value);
                    } else {
                        // 객체나 기타 타입인 경우 문자열로 변환
                        valueToEncode = String(value);
                    }
                    
                    const encodedLength = encoding.encode(valueToEncode).length;
                    contentTokens += encodedLength;
                    messageTokens += encodedLength;
                    
                    if (key === 'name') {
                        messageTokens += tokensPerName;
                    }
                }
            } catch (error) {
                // 실리태번 서버는 메시지 전체를 try-catch로 감싸고 있습니다
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_TOKEN_20004', '메시지 토크나이징 오류', error);
                }
            }
            
            // 각 메시지마다 padding 추가
            // 클라이언트가 [message] 형태로 보내면, 서버는 배열을 받아서
            // 배열 내 모든 메시지를 처리한 후 마지막에 padding을 한 번만 추가합니다.
            // 하지만 클라이언트는 각 메시지를 개별적으로 보내므로,
            // 각 요청마다 padding이 추가됩니다 (배열이 [message] 1개이므로).
            messageTokens += tokensPadding;
            
            // gpt-3.5-turbo-0301 특별 처리
            // 클라이언트가 각 메시지를 개별적으로 보내므로, 각 요청마다 추가됩니다.
            if (model.includes('gpt-3.5-turbo-0301')) {
                messageTokens += 9;
            }
            
            // 클라이언트는 각 서버 결과를 합산
            tokenCount += messageTokens;
        }
        
        // 실리태번 클라이언트 로직: !full이면 -2
        if (!full) {
            tokenCount -= 2;
        }

        const finalCount = Math.max(0, tokenCount);

        return finalCount;
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_TOKEN_15007', '토큰 계산 오류', error);
        }
        // 오류 발생 시 추정 방식 사용
        return estimateTokens(messageArray, full, model);
    }
}

/**
 * 개선된 토큰 추정 방식 (한글과 영어 구분)
 * tiktoken을 사용할 수 없을 때 폴백으로 사용
 * @param {Array} messages - 메시지 배열
 * @returns {number} 추정 토큰 수
 */
function estimateTokens(messages, full = true, model = 'gpt-3.5-turbo') {
    // 실리태번 클라이언트 사이드 추정 방식
    // 클라이언트는 각 메시지를 개별적으로 서버에 보낸 것처럼 계산:
    //   token_count = -1 (클라이언트 시작값)
    //   각 메시지마다:
    //     - 서버는 [message] 단일 요소 배열을 받아서 계산
    //     - 서버: num_tokens = 0, num_tokens += tokensPerMessage, 인코딩, name 처리
    //     - num_tokens += tokensPadding (각 요청마다!)
    //     - gpt-3.5-turbo-0301이면: num_tokens += 9 (각 요청마다!)
    //   클라이언트는: token_count += 서버결과
    //   마지막에: if (!full) token_count -= 2
    
    // 메시지가 배열이 아닌 단일 객체인 경우 배열로 변환
    const messageArray = Array.isArray(messages) ? messages : [messages];
    
    // 모델별 설정
    const tokensPerMessage = model.includes('gpt-3.5-turbo-0301') ? 4 : 3;
    const tokensPerName = model.includes('gpt-3.5-turbo-0301') ? -1 : 1;
    const tokensPadding = 3;
    
    // 클라이언트는 -1로 시작
    let tokenCount = -1;
    
    for (const message of messageArray) {
        if (!message || typeof message !== 'object') continue;
        
        // 각 메시지의 서버 결과 계산 (서버는 0으로 시작)
        let messageTokens = 0;
        messageTokens += tokensPerMessage;
        
        for (const [key, value] of Object.entries(message)) {
            if (typeof value === 'string' && value.length > 0) {
                const content = value;
                
                // 한글/영어 구분하여 토큰 추정
                let koreanChars = 0;
                let englishChars = 0;
                
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    const code = char.charCodeAt(0);
                    
                    // 한글 범위: 0xAC00-0xD7A3 (가-힣), 0x3131-0x318E (자모)
                    if ((code >= 0xAC00 && code <= 0xD7A3) || 
                        (code >= 0x3131 && code <= 0x318E) ||
                        (code >= 0x1100 && code <= 0x11FF)) { // 한글 자모
                        koreanChars++;
                    } else if ((code >= 0x0020 && code <= 0x007E) || // ASCII
                               (code >= 0x00A0 && code <= 0x00FF)) { // Latin-1
                        englishChars++;
                    } else {
                        // 기타 문자 (중국어, 일본어 등)는 한글과 비슷하게 처리
                        koreanChars++;
                    }
                }
                
                // 토큰 추정: tiktoken과 유사한 비율로 추정
                // 실제 tiktoken 테스트 결과를 기반으로:
                // - 한글: 1자 ≈ 1.5~2.0 토큰 (BPE 기반, cl100k_base 기준)
                //   실제 측정 결과: 한글 1자 ≈ 1.8 토큰 (평균)
                // - 영어: 4자 ≈ 1 토큰 (평균 단어 길이 고려)
                // 실리태번과의 비교 테스트를 통해 1.8로 조정
                const contentTokens = Math.ceil(koreanChars * 1.8) + Math.ceil(englishChars / 4);
                messageTokens += contentTokens;
                
                if (key === 'name') {
                    messageTokens += tokensPerName;
                }
            }
        }
        
        // 각 메시지마다 padding 추가 (서버는 각 요청마다 padding 추가)
        messageTokens += tokensPadding;
        
        // gpt-3.5-turbo-0301 특별 처리 (각 요청마다 추가)
        if (model.includes('gpt-3.5-turbo-0301')) {
            messageTokens += 9;
        }
        
        // 클라이언트는 각 서버 결과를 합산
        tokenCount += messageTokens;
    }
    
    // 실리태번 클라이언트 로직: !full이면 -2
    if (!full) {
        tokenCount -= 2;
    }
    
    return Math.max(0, tokenCount);
}

/**
 * 현재 사용 중인 모델을 가져오기
 * @param {Object} promptManager - PromptManager 인스턴스
 * @returns {string} 모델 이름
 */
function getCurrentModel(promptManager) {
    if (!promptManager || !promptManager.serviceSettings) {
        return 'gpt-3.5-turbo'; // 기본값
    }
    
    const settings = promptManager.serviceSettings;
    
    // 다양한 API 설정 확인
    const model = settings.openai_model || 
                  settings.model || 
                  settings.anthropic_model ||
                  settings.vertex_model ||
                  'gpt-3.5-turbo';
    
    return model;
}

