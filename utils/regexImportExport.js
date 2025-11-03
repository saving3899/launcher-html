/**
 * 정규식 불러오기/내보내기 유틸리티
 * 실리태번과 호환되는 형식으로 불러오기/내보내기
 */


/**
 * UUID v4 생성 (실리태번과 동일)
 * @returns {string} UUID v4 문자열
 */
function uuidv4() {
    if ('randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 배열을 객체로 변환 (ID를 키로 사용)
 * @param {Array} scripts - 스크립트 배열
 * @returns {Object} 스크립트 객체 (ID를 키로 사용)
 */
function scriptsArrayToObject(scripts) {
    const result = {};
    scripts.forEach(script => {
        if (script.id) {
            result[script.id] = script;
        }
    });
    return result;
}

/**
 * 객체를 배열로 변환
 * @param {Object} scripts - 스크립트 객체
 * @returns {Array} 스크립트 배열
 */
function scriptsObjectToArray(scripts) {
    return Object.values(scripts || {});
}

/**
 * 정규식 불러오기 (실리태번 방식)
 * @param {File} file - JSON 파일
 * @param {string} scriptType - 'global' 또는 'character'
 * @param {string|null} characterId - 캐릭터 ID (캐릭터 한정일 경우)
 * @returns {Promise<object>} 불러오기 결과
 */
async function importRegex(file, scriptType = 'global', characterId = null) {
    try {
        // 파일 읽기 (실리태번과 동일: getFileText 대신 parseJsonFile 사용)
        const data = await parseJsonFile(file);
        
        // 실리태번 방식: 배열 또는 객체 모두 처리
        let scriptsArray = [];
        if (Array.isArray(data)) {
            // 배열인 경우: 각 항목을 처리 (실리태번의 onRegexImportFileChange와 동일)
            scriptsArray = data;
        } else if (typeof data === 'object' && data !== null) {
            // 객체인 경우: 단일 스크립트로 처리
            scriptsArray = [data];
        } else {
            throw new Error('유효하지 않은 정규식 파일 형식입니다.');
        }

        // 기존 스크립트 로드 (객체 형식)
        let existingScripts = {};
        if (scriptType === 'character' && characterId) {
            existingScripts = await RegexScriptStorage.loadCharacterRegex(characterId);
        } else {
            existingScripts = await RegexScriptStorage.loadAll();
        }

        // 객체를 배열로 변환
        const existingScriptsArray = scriptsObjectToArray(existingScripts);

        // 각 스크립트를 실리태번 방식으로 처리 (onRegexImportObjectChange와 동일)
        let importedCount = 0;
        for (const regexScript of scriptsArray) {
            try {
                // scriptName 필수 (실리태번과 동일)
                if (!regexScript.scriptName) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_REGEX_20001', '정규식 스크립트 이름이 없어 건너뜀');
                    }
                    continue;
                }

                // 새로운 UUID 할당 (실리태번과 동일: 기존 ID 무시)
                regexScript.id = uuidv4();

                // 배열에 push (실리태번과 동일)
                existingScriptsArray.push(regexScript);
                importedCount++;
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_REGEX_11001', '정규식 스크립트 처리 오류', error);
                }
                // 실패한 스크립트는 건너뛰고 계속 진행
            }
        }

        // 배열을 객체로 변환하여 저장
        const mergedScripts = scriptsArrayToObject(existingScriptsArray);

        // 저장
        if (scriptType === 'character' && characterId) {
            await RegexScriptStorage.saveCharacterRegex(characterId, mergedScripts);
        } else {
            await RegexScriptStorage.saveAll(mergedScripts);
        }

        return {
            success: true,
            count: importedCount,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_REGEX_11002', '정규식 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message || '정규식 파일을 읽을 수 없습니다.',
        };
    }
}

/**
 * 파일명 정리 함수 (실리태번과 동일)
 * @param {string} name - 원본 이름
 * @returns {string} 정리된 파일명
 */
function sanitizeFileName(name) {
    return name.replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase();
}

/**
 * 다운로드 함수 (기본 다운로드 폴더에 저장)
 * @param {string} content - 파일 내용
 * @param {string} fileName - 파일명
 * @param {string} contentType - 콘텐츠 타입
 * @returns {Promise<boolean>} 성공 시 true 반환
 */
async function download(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    
    // 기본 다운로드 방식 사용 (기기별 기본 다운로드 위치에 저장)
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    return true; // 항상 성공
}

/**
 * 정규식 내보내기 (실리태번 방식)
 * @param {string} scriptType - 'global' 또는 'character'
 * @param {string|null} characterId - 캐릭터 ID (캐릭터 한정일 경우)
 * @param {string|null} scriptId - 스크립트 ID (단일 스크립트 내보내기일 경우)
 * @returns {Promise<object>} 내보내기 결과
 */
async function exportRegex(scriptType = 'global', characterId = null, scriptId = null) {
    try {
        let scripts = {};
        
        if (scriptType === 'character' && characterId) {
            scripts = await RegexScriptStorage.loadCharacterRegex(characterId);
        } else {
            scripts = await RegexScriptStorage.loadAll();
        }

        let fileName;
        let fileData;

        // 단일 스크립트 내보내기 (실리태번 방식: 객체 그대로 내보내기)
        if (scriptId && scripts[scriptId]) {
            const script = scripts[scriptId];
            fileName = `regex-${sanitizeFileName(script.scriptName)}.json`;
            fileData = JSON.stringify(script, null, 4);
            
            const downloadSuccess = await download(fileData, fileName, 'application/json');
            
            return {
                success: downloadSuccess,
                count: downloadSuccess ? 1 : 0,
                cancelled: !downloadSuccess,
            };
        } else if (scriptId) {
            return {
                success: false,
                error: '스크립트를 찾을 수 없습니다.',
            };
        }

        // 일괄 내보내기 (실리태번 방식: 배열로 내보내기)
        const scriptsArray = scriptsObjectToArray(scripts);
        fileName = `regex-${new Date().toISOString()}.json`;
        fileData = JSON.stringify(scriptsArray, null, 4);
        
        const downloadSuccess = await download(fileData, fileName, 'application/json');
        
        return {
            success: downloadSuccess,
            count: downloadSuccess ? scriptsArray.length : 0,
            cancelled: !downloadSuccess,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_REGEX_11003', '정규식 내보내기 오류', error);
        }
        return {
            success: false,
            error: error.message,
        };
    }
}

// window 객체에 명시적으로 할당 (fileManager.js의 메서드와 이름 충돌 방지)
if (typeof window !== 'undefined') {
    window.exportRegexGlobal = exportRegex;
    window.importRegexGlobal = importRegex;
}
