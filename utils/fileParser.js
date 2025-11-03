/**
 * 파일 파싱 유틸리티
 * 실리태번과 동일한 방식으로 파일을 파싱하여 완벽한 호환성 보장
 */

/**
 * 파일을 ArrayBuffer로 읽기
 * @param {File} file - 읽을 파일
 * @returns {Promise<ArrayBuffer>} 파일의 ArrayBuffer
 */
function getFileBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * 한글/한자 문자 검증 (UTF-8 디코딩이 올바른지 확인)
 * @param {string} text - 검증할 텍스트
 * @returns {boolean} 한글이나 한자가 올바르게 표시되면 true
 */
function isValidKoreanText(text) {
    // 깨진 패턴 감지 (Latin-1으로 잘못 읽힌 경우)
    const brokenPatterns = ['ë', 'ì', 'í', 'Ã', 'â', '€', '¢', '£'];
    if (brokenPatterns.some(pattern => text.includes(pattern))) {
        return false;
    }
    
    // 한글 범위: \uAC00-\uD7A3 (가-힣)
    // 한자 범위: \u4E00-\u9FFF
    const koreanRegex = /[\uAC00-\uD7A3]/;
    const chineseRegex = /[\u4E00-\u9FFF]/;
    
    // 한글이나 한자가 있고 깨진 패턴이 없으면 유효
    if (koreanRegex.test(text) || chineseRegex.test(text)) {
        // 깨진 문자가 있는지 확인
        const hasBrokenChars = text.match(/[^\u0000-\u007F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\uAC00-\uD7A3\u4E00-\u9FFF\s\n\r\t]/);
        return !hasBrokenChars;
    }
    
    return true;
}

/**
 * CP949/EUC-KR 바이트를 UTF-8로 변환 시도 (간단한 변환)
 * 참고: 완벽한 변환은 복잡하므로 기본적인 경우만 처리
 */
function tryCP949ToUTF8(uint8Array) {
    // CP949/EUC-KR은 브라우저에서 직접 지원하지 않으므로
    // TextDecoder는 사용할 수 없습니다.
    // 하지만 파일이 이미 잘못 인코딩되어 저장된 경우가 많으므로
    // 실제로는 파일을 UTF-8로 다시 저장해야 합니다.
    
    // 일단 UTF-8로 디코딩 시도 (대부분의 경우 파일이 UTF-8이어야 함)
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(uint8Array);
}

/**
 * JSON 파일 파싱 (실리태번 방식: getFileText와 동일)
 * @param {File} file - JSON 파일
 * @returns {Promise<object>} 파싱된 JSON 객체
 */
async function parseJsonFile(file) {
    return new Promise((resolve, reject) => {
        // 실리태번 방식: FileReader.readAsText 사용 (인코딩 자동 감지)
        const reader = new FileReader();
        reader.readAsText(file);
        
        reader.onload = function () {
            try {
                const text = String(reader.result);
                const parsed = JSON.parse(text);
                resolve(parsed);
            } catch (error) {
                reject(new Error(`JSON 파싱 오류: ${error.message}`));
            }
        };
        
        reader.onerror = function (error) {
            reject(new Error(`파일 읽기 오류: ${error.message || '알 수 없는 오류'}`));
        };
    });
}

/**
 * PNG 파일에서 임베드된 JSON 데이터 추출
 * 실리태번과 동일한 방식으로 Chara Card V2 형식 지원
 * @param {Uint8Array} data - PNG 파일 데이터 (Uint8Array)
 * @param {string} identifier - 추출할 데이터 식별자 (기본값: 'chara')
 * @returns {object|null} 추출된 JSON 객체 또는 null
 */
function extractDataFromPng(data, identifier = 'chara') {
    // PNG 헤더 검증
    if (!data || data.length < 8) {
        return null;
    }
    
    // PNG 시그니처 검증: 89 50 4E 47 0D 0A 1A 0A
    if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47 ||
        data[4] !== 0x0D || data[5] !== 0x0A || data[6] !== 0x1A || data[7] !== 0x0A) {
        return null;
    }

    let uint8 = new Uint8Array(4);
    let uint32 = new Uint32Array(uint8.buffer);

    let ended = false;
    let chunks = [];
    let idx = 8; // PNG 시그니처 이후부터 시작

    // PNG 청크 파싱
    while (idx < data.length) {
        // 청크 길이 읽기 (Uint32, 빅엔디안)
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        // 청크 길이 (데이터 + 4바이트 청크 이름)
        let length = uint32[0] + 4;
        let chunk = new Uint8Array(length);
        
        // 청크 이름 읽기
        chunk[0] = data[idx++];
        chunk[1] = data[idx++];
        chunk[2] = data[idx++];
        chunk[3] = data[idx++];

        // 청크 이름을 ASCII로 변환
        let name = (
            String.fromCharCode(chunk[0]) +
            String.fromCharCode(chunk[1]) +
            String.fromCharCode(chunk[2]) +
            String.fromCharCode(chunk[3])
        );

        // IHDR가 첫 번째 청크여야 함
        if (!chunks.length && name !== 'IHDR') {
            // IHDR 헤더가 없음 (경고하지만 계속 진행)
        }

        // IEND 청크를 만나면 종료
        if (name === 'IEND') {
            ended = true;
            chunks.push({
                name: name,
                data: new Uint8Array(0),
            });
            break;
        }

        // 청크 데이터 읽기
        for (let i = 4; i < length; i++) {
            chunk[i] = data[idx++];
        }

        // CRC 읽기 (검증은 생략)
        idx += 4;

        // 청크 데이터 추출 (이름 제외)
        let chunkData = new Uint8Array(chunk.buffer.slice(4));

        chunks.push({
            name: name,
            data: chunkData,
        });
    }

    if (!ended) {
        return null;
    }

    // tEXt 청크에서 identifier로 시작하는 데이터 찾기
    let found = chunks.filter(x => (
        x.name === 'tEXt' &&
        x.data.length > identifier.length &&
        x.data.slice(0, identifier.length).every((v, i) => String.fromCharCode(v) === identifier[i])
    ));

    if (found.length === 0) {
        return null;
    }

    try {
        // Base64 디코딩
        let b64buf = '';
        let bytes = found[0].data;
        
        // identifier + null byte를 건너뛰고 Base64 데이터 읽기
        for (let i = identifier.length + 1; i < bytes.length; i++) {
            b64buf += String.fromCharCode(bytes[i]);
        }
        
        // Base64 디코딩 (바이너리 문자열 반환)
        const binaryString = atob(b64buf);
        
        // 바이너리 문자열을 UTF-8 바이트 배열로 변환
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
        }
        
        // TextDecoder로 UTF-8 디코딩
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const utf8String = decoder.decode(uint8Array);
        
        // JSON 파싱
        let decoded = JSON.parse(utf8String);
        return decoded;
    } catch (e) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6014', '이미지의 Base64 디코딩 오류', e);
        }
        return null;
    }
}

/**
 * JSONL 파일 파싱 (채팅 데이터)
 * 실리태번 JSONL 형식 지원
 * @param {File} file - JSONL 파일
 * @returns {Promise<object>} 파싱된 채팅 데이터
 *   - metadata: 첫 번째 줄의 메타데이터
 *   - messages: 나머지 줄의 메시지 배열
 */
async function parseJsonlFile(file) {
    return new Promise((resolve, reject) => {
        // FileReader.readAsText를 먼저 시도 (브라우저가 자동으로 인코딩 감지)
        const fileReader = new FileReader();
        fileReader.readAsText(file, 'UTF-8');
        
        fileReader.onload = (event) => {
            try {
                const text = String(event.target.result);
                
                // JSON 파싱 가능 여부로 검증 (더 정확한 방법)
                // 첫 줄이 유효한 JSON이면 인코딩이 올바른 것으로 간주
                const lines = text.trim().split('\n').filter(line => line.trim());
                if (lines.length === 0) {
                    reject(new Error('JSONL 파일이 비어있습니다'));
                    return;
                }
                
                try {
                    // 첫 번째 줄(메타데이터) 파싱 시도
                    JSON.parse(lines[0]);
                    // 파싱 성공하면 인코딩이 올바른 것으로 간주하고 진행
                    processJsonlText(text, resolve, reject);
                } catch (parseError) {
                    // JSON 파싱 실패 시 인코딩 문제일 수 있음
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_FILE_20006', 'JSONL 파일 JSON 파싱 실패, 인코딩 문제 가능성');
                    }
                    
                    // ArrayBuffer로 재시도
                    const retryReader = new FileReader();
                    retryReader.readAsArrayBuffer(file);
                    retryReader.onload = (retryEvent) => {
                        try {
                            const buffer = retryEvent.target.result;
                            const uint8Array = new Uint8Array(buffer);
                            
                            // BOM 제거 (UTF-8 BOM: EF BB BF)
                            let startOffset = 0;
                            if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
                                startOffset = 3;
                            }
                            
                            // TextDecoder로 UTF-8 강제 디코딩
                            const decoder = new TextDecoder('utf-8', { fatal: false });
                            const retryText = decoder.decode(uint8Array.slice(startOffset));
                            
                            // 다시 JSON 파싱 시도
                            const retryLines = retryText.trim().split('\n').filter(line => line.trim());
                            if (retryLines.length > 0) {
                                try {
                                    JSON.parse(retryLines[0]);
                                    // 파싱 성공하면 사용
                                    processJsonlText(retryText, resolve, reject);
                                    return;
                                } catch (e) {
                                    // 여전히 실패
                                }
                            }
                        } catch (e) {
                            // ArrayBuffer 읽기 실패
                        }
                        
                        // 모든 시도 실패
                        const errorMsg = '파일을 읽을 수 없습니다. 파일이 UTF-8 형식의 유효한 JSONL 파일인지 확인해주세요.';
                        reject(new Error(errorMsg));
                    };
                    retryReader.onerror = () => {
                        const errorMsg = '파일 읽기 중 오류가 발생했습니다.';
                        reject(new Error(errorMsg));
                    };
                }
            } catch (error) {
                reject(new Error(`JSONL 파싱 오류: ${error.message}`));
            }
        };
        
        fileReader.onerror = (error) => reject(new Error(`파일 읽기 오류: ${error.message || '알 수 없는 오류'}`));
    });
}

/**
 * JSONL 텍스트 처리 헬퍼 함수
 */
function processJsonlText(text, resolve, reject) {
    try {
        const lines = text.trim().split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            reject(new Error('JSONL 파일이 비어있습니다'));
            return;
        }

        // 첫 번째 줄은 메타데이터
        const metadata = JSON.parse(lines[0]);
        
        // 나머지 줄들은 메시지
        const messages = lines.slice(1).map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_FILE_20007', 'JSONL 메시지 파싱 오류');
                }
                return null;
            }
        }).filter(msg => msg !== null);

        resolve({
            metadata: metadata,
            messages: messages,
        });
    } catch (error) {
        reject(new Error(`JSONL 파싱 오류: ${error.message}`));
    }
}

/**
 * 파일 확장자 확인
 * @param {string} filename - 파일 이름
 * @returns {string} 확장자 (소문자)
 */
function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

